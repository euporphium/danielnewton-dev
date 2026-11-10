#!/usr/bin/env node
/* eslint-disable no-console -- CLI script; console output is its interface */
// Deterministic checks on content source files (no build needed):
//
// - No unresolved author markers: `[[DANIEL: ...]]` marks something only
//   Daniel can write (personal experience, opinions). It must be resolved
//   before merge.
// - No placeholder links (example.com/.org/.net, localhost).
// - Posts: pubDatetime/modDatetime include a time and an explicit offset
//   (e.g. 2025-06-08T12:00:00-05:00), so the displayed date can't shift a day.
// - Posts: at least one tag; tags are lowercase kebab-case.
//
//   node scripts/check-content.mjs
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const CONTENT_DIRS = [
  "src/content/posts",
  "src/content/projects",
  "src/content/pages",
];
const MARKER = /\[\[DANIEL:/;
const PLACEHOLDER_LINK =
  /\bhttps?:\/\/(?:[\w-]+\.)*(?:example\.(?:com|org|net)|localhost)\b/i;
const DATETIME_WITH_OFFSET =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;
const TAG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries
    .filter(e => e.isFile() && /\.mdx?$/.test(e.name))
    .map(e => path.join(e.parentPath, e.name));
}

/** Top-level `key: value` pairs of the YAML frontmatter, values as raw text. */
function frontmatter(source) {
  const block = source.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";
  const fields = {};
  for (const line of block.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z][\w]*):\s*(.*)$/);
    if (m) fields[m[1]] = m[2].trim().replace(/^(['"])(.*)\1$/, "$2");
  }
  return fields;
}

function parseTags(raw) {
  if (raw === undefined || raw === "") return null;
  const inline = raw.match(/^\[(.*)\]$/);
  if (!inline) return null; // block-style lists aren't used in this repo
  return inline[1]
    .split(",")
    .map(t => t.trim().replace(/^(['"])(.*)\1$/, "$2"))
    .filter(Boolean);
}

const failures = [];
let checked = 0;

for (const dir of CONTENT_DIRS) {
  for (const file of await listFiles(dir)) {
    checked++;
    const source = await readFile(file, "utf8");
    const lines = source.split(/\r?\n/);

    lines.forEach((line, i) => {
      if (MARKER.test(line)) {
        failures.push(`${file}:${i + 1}: unresolved [[DANIEL: ...]] marker`);
      }
      if (PLACEHOLDER_LINK.test(line)) {
        failures.push(`${file}:${i + 1}: placeholder link`);
      }
    });

    if (dir !== "src/content/posts") continue;

    const fm = frontmatter(source);
    for (const key of ["pubDatetime", "modDatetime"]) {
      const value = fm[key];
      if (value === undefined || value === "" || value === "null") {
        if (key === "pubDatetime") failures.push(`${file}: missing ${key}`);
        continue;
      }
      if (!DATETIME_WITH_OFFSET.test(value)) {
        failures.push(
          `${file}: ${key} "${value}" needs a time and offset, e.g. 2025-06-08T12:00:00-05:00`
        );
      }
    }

    const tags = parseTags(fm.tags);
    if (!tags || tags.length === 0) {
      failures.push(`${file}: needs at least one tag, e.g. tags: [astro, css]`);
    } else {
      for (const tag of tags.filter(t => !TAG.test(t))) {
        failures.push(`${file}: tag "${tag}" must be lowercase kebab-case`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error("Content check failed:");
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`Content check OK: ${checked} files.`);
