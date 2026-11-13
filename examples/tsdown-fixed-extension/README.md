# tsdown `fixedExtension` demo

The package from the post
[Test the npm package you publish, not the source tree](https://www.danielnewton.dev/blog/test-the-npm-package-you-publish/).

`package.json` points `exports` at `./dist/index.js`. With tsdown 0.16.0 or later
and no `fixedExtension` setting, the build writes `dist/index.mjs`, so the packed
package cannot be imported even though the type check and the test pass.

Tested with Node 26.12.1 and npm 12.0.2. Dependency versions are pinned in
`package.json`.

```bash
npm install
npm run typecheck      # passes
npm test               # passes
bash verify-pack.sh    # fails: publint reports that ./dist/index.js does not exist
```

To see it pass, add `fixedExtension: false` to `tsdown.config.ts` and run
`bash verify-pack.sh` again. It ends by printing `[ 'greet' ]`.

To see the behaviour before the default changed, run
`npm install --no-save tsdown@0.15.12` and then `bash verify-pack.sh`.
