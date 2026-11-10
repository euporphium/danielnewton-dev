# CLAUDE.md

Guidance for AI agents working in this repository.

## Overview

Personal site and blog for Daniel Newton (https://www.danielnewton.dev), built on the
[AstroPaper](https://github.com/satnaing/astro-paper) theme (Astro 7, Tailwind CSS 4,
MDX). It's a single package at the repo root, managed with pnpm and deployed by Vercel.

AstroPaper is merged in as git history, not installed as a package. Theme updates
arrive with `git merge` (see "Updating AstroPaper"), so **keep edits to theme files
small and deliberate**.

## Commands

```bash
pnpm install
pnpm dev            # dev server
pnpm build          # astro check + astro build + Pagefind search index
pnpm preview        # serve dist/
pnpm check:urls     # verify published URLs, canonicals, RSS GUIDs and dates in dist/
pnpm check:urls --base https://<deployment>   # same, against a deployment
# Protected Vercel previews: set VERCEL_AUTOMATION_BYPASS_SECRET first
pnpm lint
pnpm format:check   # CI runs lint, format:check and build
```

Node >= 22.23.4.

## Where things live

| Path | What |
| --- | --- |
| `astro-paper.config.ts` | Site identity, feature flags, socials, share links. **Prefer changing behaviour here** |
| `src/styles/theme.css` | Color tokens (intended customization point) |
| `src/content/posts/` | Blog posts (`.md`/`.mdx`). Filename = slug = URL `/blog/<slug>/` |
| `src/content/projects/` | Projects (site-specific collection) |
| `src/content/pages/about.md` | About page |
| `src/content.config.ts` | Collection schemas |
| `src/components/site/` | Site-specific components (not part of AstroPaper) |
| `src/pages/projects/`, `src/pages/privacy.astro` | Site-specific pages |
| `scripts/` | Repo checks (`check-urls.mjs` + `url-baseline.json`) |
| `vercel.json` | Vercel install/build/output settings |

## Deliberate changes to AstroPaper files

Keep this list current. It's what to re-check after an upstream merge.

- Posts are served at `/blog/` instead of `/posts/`: `src/pages/posts` was renamed to
  `src/pages/blog`, plus `src/utils/getPostPaths.ts`, `src/components/Header.astro`
  (nav link + active state), `src/components/Breadcrumb.astro` and
  `src/pages/index.astro`. Published URLs must not change.
- `Header.astro` has a Projects nav link; `Breadcrumb.astro` has a `projects` label.
- `astro.config.ts` adds `@astrojs/react` (React islands in MDX, e.g. `Marquee`).
- `src/content.config.ts` adds the `projects` collection.
- `.prettierrc` disables formatting inside code blocks in content files, so published
  code samples stay exactly as written.
- AstroPaper's sample posts, FUNDING.yml, issue/PR templates, Docker and commitizen
  files were removed.

## Content conventions

- Required frontmatter: `title`, `description`, `pubDatetime`, `tags`.
- Write `pubDatetime`/`modDatetime` with an explicit UTC offset, e.g.
  `2025-06-08T12:00:00-05:00`. Dates are displayed in `America/Chicago`. A bare
  date or a UTC-midnight time shows as the previous day.
- `draft: true` and future dates hide a post in production builds, **including Vercel
  previews**. To preview a new post on a PR, leave `draft` off and use today's date.
  Merging the PR is what publishes it.
- Never rename a published post file: the filename is its URL. Published URLs are
  listed in `scripts/url-baseline.json`; add new posts there once they're live.
- Images: put them next to the post (or in `src/assets/`) and reference them relatively
  so Astro optimizes them.

## Updating AstroPaper

```bash
git fetch astro-paper --tags     # remote: https://github.com/satnaing/astro-paper.git
git merge vX.Y.Z                  # one release at a time; read its release notes first
```

Expect conflicts where upstream changes files listed above, and modify/delete conflicts
for upstream sample posts (resolve with `git rm`). Then run `pnpm build`,
`pnpm check:urls`, `pnpm lint` and `pnpm format:check`.
