#!/usr/bin/env node
/* eslint-disable no-console -- CLI script; console output is its interface */
// Checks that every same-site link in the built site (dist/) points at a page
// or file that exists. External links aren't fetched (too flaky for CI).
//
//   pnpm build && node scripts/check-links.mjs
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";

const DIST = "dist";
const SITE_ORIGIN = "https://www.danielnewton.dev";

const exists = p =>
  access(p).then(
    () => true,
    () => false
  );

async function resolves(pathname) {
  const clean = decodeURIComponent(pathname.split(/[?#]/)[0]);
  if (clean === "" || clean === "/") return exists(path.join(DIST, "index.html"));
  const target = path.join(DIST, clean);
  if (clean.endsWith("/")) return exists(path.join(target, "index.html"));
  return (
    (await exists(target)) || (await exists(path.join(target, "index.html")))
  );
}

const htmlFiles = (await readdir(DIST, { recursive: true }))
  .filter(f => f.endsWith(".html"))
  .map(f => path.join(DIST, f));

const broken = new Map();
let checked = 0;

for (const file of htmlFiles) {
  const html = await readFile(file, "utf8");
  for (const [, href] of html.matchAll(/<a\s[^>]*?href="([^"]+)"/g)) {
    let pathname;
    if (href.startsWith(SITE_ORIGIN)) pathname = href.slice(SITE_ORIGIN.length);
    else if (href.startsWith("/") && !href.startsWith("//")) pathname = href;
    else continue;
    checked++;
    if (!(await resolves(pathname))) {
      const pages = broken.get(pathname) ?? new Set();
      pages.add(path.relative(DIST, file));
      broken.set(pathname, pages);
    }
  }
}

if (broken.size > 0) {
  console.error("Broken internal links:");
  for (const [target, pages] of broken) {
    console.error(`  ✗ ${target} (from ${[...pages].join(", ")})`);
  }
  process.exit(1);
}
console.log(
  `Internal links OK: ${checked} links in ${htmlFiles.length} pages.`
);
