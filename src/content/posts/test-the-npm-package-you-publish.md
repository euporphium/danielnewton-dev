---
title: "Test the npm package you publish, not the source tree"
description: "A tsdown upgrade changed my library's output from .js to .mjs while package.json still pointed at .js. The type check, Storybook build and tests all passed. Here is why, and the two checks that catch it."
pubDatetime: 2026-11-12T01:00:00-06:00
tags: [tooling, npm, testing]
---

In August, a version of my React component library, [`@i258/ui`](https://www.npmjs.com/package/@i258/ui), went to npm in a state where it could not be imported. Version 0.5.1 had a `package.json` whose `exports` pointed at `./dist/index.js` and a tarball that contained `dist/index.mjs` instead. The release had passed CI and the publish workflow.

The apps that depend on the library could not build against it. The [pull request that fixed it](https://github.com/i258-net/ui/pull/47) records their bundlers failing with `Can't resolve '@i258/ui'`. A fixed version, 0.5.2, was on npm a little under four hours after the broken one. This post covers what changed, why none of the existing checks could see it, and the two checks that do.

## What changed

A [grouped Dependabot pull request](https://github.com/i258-net/ui/pull/31) moved [tsdown](https://tsdown.dev/), the bundler the library is built with, from 0.14.2 to 0.22.14. Its CI job passed: type check, build, tests, Storybook build and screenshot tests. Two days later, the commit that became 0.5.1 passed the same job and then the publish workflow.

Between those two versions, tsdown 0.16.0 changed a default. The [release notes](https://github.com/rolldown/tsdown/releases/tag/v0.16.0) list it under breaking changes:

> Defaults `fixedExtension` to true when platform is `node`
>
> This change may update the `.js` file extension to `.mjs` or `.cjs`. When the `platform` is set to `node` (the default behavior), the default file extension will no longer be determined by the `type` field in `package.json`, but will instead be fixed as either `.cjs` or `.mjs`.
>
> This modification may affect the `main`, `module`, `types`, `exports`, and `bin` fields in `package.json`.

`platform` defaults to `node`, so this applies to any config that sets neither option. For an ESM build like this one, in a package with `"type": "module"`, tsdown wrote `.js` files before 0.16.0. From 0.16.0 on, it writes `.mjs`.

That release came out in November 2025, almost ten months before the upgrade. The Dependabot pull request did quote tsdown's release notes, but only the most recent ones before the text was cut off, and nothing in it mentions `fixedExtension`. The upgrade crossed eight minor versions in one step, and the one note that mattered was not in the pull request.

Other people ran into it much sooner. The day after 0.16.0 was released, [a comment on the change](https://github.com/rolldown/tsdown/pull/517#issuecomment-3492274115) reported the same thing: `"exports": "./dist/index.js"` now "pointed to a non-existing file".

## Reproducing it

Here is a small package that shows the problem. The [complete package](https://github.com/euporphium/danielnewton-dev/tree/main/examples/tsdown-fixed-extension), with pinned dependency versions, is in this site's repository. I ran it on Node 26.12.1. Its `package.json`, without the dependencies:

```json
{
  "name": "demo-lib",
  "version": "1.0.0",
  "type": "module",
  "exports": {
    ".": "./dist/index.js"
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsdown",
    "typecheck": "tsc --noEmit",
    "test": "node --test"
  }
}
```

`tsdown.config.ts`:

```ts
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
});
```

`src/index.ts` exports one function, and `src/index.test.ts` imports it from `./index.ts` and asserts on the result. Those two files and the `tsconfig.json` are in the linked package.

With tsdown 0.15.12, the build writes `dist/index.js`. With tsdown 0.23.7, the current release, the same files produce this (output trimmed):

```
$ npm run build
ℹ dist/index.mjs  0.08 kB │ gzip: 0.10 kB
✔ Build complete in 36ms

$ npm run typecheck

$ npm test
ℹ tests 1
ℹ pass 1
ℹ fail 0
```

The build succeeds, the type check is clean and the test passes. Then pack it, install the tarball into an empty project and import it:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '<tmp>/node_modules/demo-lib/dist/index.js'
```

The published 0.5.1 fails the same way. A bundler says it differently. This is esbuild:

```
✘ [ERROR] Could not resolve "@i258/ui"
```

## Why every check passed

Each check read the source tree, and the source tree was fine.

- The type check ran `tsc` over `src`.
- Storybook [aliased `@i258/ui` to `src/index.ts`](https://github.com/i258-net/ui/blob/374c0e8a/apps/workshop/.storybook/main.ts), so the stories never touched `dist`.
- The component tests and the screenshot tests both run on those stories, so they never touched `dist` either.
- The build step did run, and it succeeded. Writing `index.mjs` is a successful build.

Nothing compared `exports` in `package.json` with the files that would be packed. npm does not check that either: 0.5.1 was published without complaint.

## Two checks that catch it

The first is [publint](https://publint.dev/), which lints a package the way it will be packed. One of its rules is that every file `package.json` points at has to exist. Version 0.5.1 is still on npm, so you can run it against the real thing:

```
$ npm pack @i258/ui@0.5.1
$ tar -tzf i258-ui-0.5.1.tgz | grep dist/index
package/dist/index.d.ts.map
package/dist/index.mjs
package/dist/index.d.ts

$ npx publint ./i258-ui-0.5.1.tgz
Errors:
1. pkg.exports["."].import is ./dist/index.js but the file does not exist.
2. pkg.exports["./button"].import is ./dist/components/button.js but the file does not exist.
3. pkg.exports["./input"].import is ./dist/components/input.js but the file does not exist.
```

It reports 14 errors in all, one for each JavaScript entry point.

publint is static. It tells you the file is there. It does not load it. The second check does: pack the package, install the tarball somewhere with no access to your source tree, and import it.

Saved as `verify-pack.sh` in the package:

```bash
#!/usr/bin/env bash
set -e

npm run build
npx publint

TARBALL="$PWD/$(npm pack | tail -n 1)"
CONSUMER="$(mktemp -d)"
trap 'rm -rf "$CONSUMER" "$TARBALL"' EXIT

cd "$CONSUMER"
npm init -y > /dev/null
npm install "$TARBALL"
node -e "import('demo-lib').then(m => console.log(Object.keys(m)))"
```

Run it with `bash verify-pack.sh`. In the demo package with the default config, it stops at publint with the "file does not exist" error. With the fix below, it finishes by printing `[ 'greet' ]`.

The library's own version of this is a script, [`pack-verify.mjs`](https://github.com/i258-net/ui/blob/main/packages/ui/scripts/pack-verify.mjs), that CI runs after the build. A coding agent wrote it along with the fix. It checks every export target against the tarball's file list, which is the part publint also covers, and then imports the package root from a clean install.

That import has a limit worth knowing. It proves the root entry point loads. It does not prove each subpath does. For those, the script only checks that the files exist. Checking that a file is present and checking that it loads are different tests, and a package with many entry points needs an import for each one to get the second.

## Fixing the mismatch

There are two ways to make `exports` and the output agree, and tsdown's maintainer [pointed to both](https://github.com/rolldown/tsdown/pull/517#issuecomment-3492775346) when people reported the break.

The library took the first: tell tsdown to keep the old behaviour.

```ts
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  fixedExtension: false,
});
```

The second is to stop writing `exports` by hand. With `exports: true`, tsdown [generates the field](https://tsdown.dev/options/package-exports) from what it built. In the demo package it rewrote `package.json` like this:

```diff
-    ".": "./dist/index.js"
+    ".": "./dist/index.mjs",
+    "./package.json": "./package.json"
```

Review the generated export map before publishing, especially custom subpaths and assets. tsdown writes the field from its own output. In the demo package, a hand-written `types` condition and a `./styles.css` subpath were both replaced by the two entries above on the next build. `@i258/ui` has both kinds of entry.

tsdown can also run publint for you. With `publint: true` in the config and publint installed, the build itself fails:

```
ERROR  [publint] pkg.exports["."] is ./dist/index.js but the file does not exist.
```

## What I took from it

The test suites need to run against the production artifact, not just the development one. Every check the library had was testing source files, and consumers never receive those. They receive a tarball.

Building, installing and importing the packed package is the smallest version of that principle, and it would have caught this failure before publication. It is a first check, not the whole job. It says nothing about whether the components behave correctly once imported, whether the type declarations are right, or whether the stylesheet and every subpath resolve. Those need their own tests against the same tarball.
