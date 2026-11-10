#!/usr/bin/env node
/* eslint-disable no-console -- CLI script; console output is its interface */
// Verifies that every URL the production site has published still resolves,
// with the same canonical URL, RSS GUID and displayed publish date.
//
//   node scripts/check-urls.mjs                 # check the local build in dist/
//   node scripts/check-urls.mjs --base <url>    # check a deployment (e.g. a Vercel preview)
//
// The baseline lives in scripts/url-baseline.json.
import { readFile } from "node:fs/promises";
import path from "node:path";

const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");

const baseline = JSON.parse(
  await readFile(new URL("./url-baseline.json", import.meta.url), "utf8")
);
const baseArg = process.argv.indexOf("--base");
const base =
  baseArg === -1 ? null : process.argv[baseArg + 1]?.replace(/\/+$/, "");

if (baseArg !== -1 && !base) {
  console.error("Usage: check-urls.mjs [--base https://preview.example.com]");
  process.exit(2);
}

async function load(pathname) {
  if (base) {
    const res = await fetch(base + pathname, { redirect: "follow" });
    return res.ok ? await res.text() : null;
  }
  const file = pathname.endsWith("/")
    ? path.join("dist", pathname, "index.html")
    : path.join("dist", pathname);
  return readFile(file, "utf8").catch(() => null);
}

const failures = [];
const fail = msg => failures.push(msg);

for (const url of baseline.pages) {
  const { pathname } = new URL(url);
  const html = await load(pathname);
  if (html === null) {
    fail(`${pathname}: missing`);
    continue;
  }
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  if (canonical !== url) fail(`${pathname}: canonical is ${canonical}`);

  const expectedDate = baseline.postDates?.[url];
  if (expectedDate) {
    const [y, m, d] = expectedDate.split("-").map(Number);
    const shown = `${d} ${MONTHS[m - 1]}, ${y}`;
    if (!html.includes(`>${shown}</time>`)) {
      fail(`${pathname}: publish date "${shown}" not displayed`);
    }
  }
}

for (const file of baseline.files) {
  if ((await load(file)) === null) fail(`${file}: missing`);
}

const rss = (await load("/rss.xml")) ?? "";
const guids = new Set(
  [...rss.matchAll(/<guid[^>]*>([^<]+)<\/guid>/g)].map(m => m[1])
);
for (const guid of baseline.rssGuids) {
  if (!guids.has(guid)) fail(`RSS: GUID ${guid} missing`);
}

const target = base ?? "dist/";
if (failures.length > 0) {
  console.error(`URL parity check failed for ${target}:`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(
  `URL parity OK for ${target}: ${baseline.pages.length} pages, ` +
    `${baseline.rssGuids.length} RSS GUIDs, ${baseline.files.length} files.`
);
