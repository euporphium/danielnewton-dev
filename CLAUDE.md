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
pnpm dev             # dev server
pnpm build           # astro check + astro build + Pagefind search index
pnpm preview         # serve dist/
pnpm check:content   # content source rules (markers, placeholder links, dates, tags)
pnpm check:urls      # published URLs, canonicals, RSS GUIDs and dates in dist/
pnpm check:urls --base https://<deployment>   # same, against a deployment
# Protected Vercel previews: set VERCEL_AUTOMATION_BYPASS_SECRET first
pnpm check:links     # internal links in dist/ resolve
pnpm lint
pnpm format:check
```

CI: `.github/workflows/ci.yml` (AstroPaper's: lint, format, build) and
`.github/workflows/site-checks.yml` (content, build, URL parity, links).

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
| `src/components/site/` | Site-specific components: PostHog, cookie consent, project metadata |
| `src/pages/projects/`, `src/pages/privacy.astro` | Site-specific pages |
| `scripts/` | Repo checks and `url-baseline.json` |
| `examples/` | Standalone, runnable packages that posts link to. Not part of the site build; each has its own pinned dependencies |
| `.github/pull_request_template.md` | Article PR checklist (sources, verification log) |
| `vercel.json` | Vercel install/build/output settings |

## Deliberate changes to AstroPaper files

Keep this list current. It's what to re-check after an upstream merge.

- Posts are served at `/blog/` instead of `/posts/`: `src/pages/posts` was renamed to
  `src/pages/blog`, plus `src/utils/getPostPaths.ts`, `src/components/Header.astro`
  (nav link + active state), `src/components/Breadcrumb.astro` and
  `src/pages/index.astro`. Published URLs must not change.
- `Header.astro` has a Projects nav link; `Breadcrumb.astro` has a `projects` label.
- `src/layouts/Layout.astro` mounts PostHog, Speed Insights and the cookie banner.
- `src/components/Footer.astro` links to `/privacy/`.
- `src/pages/index.astro` hero text and meta description are the site's own.
- `src/i18n/lang/en.ts`: "Posts" labels read "Blog".
- `src/styles/theme.css` holds the site palette; `public/favicon.svg` is the DN monogram.
- `astro.config.ts` adds `@astrojs/react` (React islands in MDX, e.g. `Marquee`) and
  uses the `github-light-default`/`github-dark-default` Shiki themes (AstroPaper's
  defaults fail WCAG AA contrast for comments).
- `src/pages/blog/[...slug]/index.astro`: heading `#` anchor links get an `aria-label`.
- `src/content.config.ts` adds the `projects` collection.
- `tsconfig.json` excludes `examples/`, whose packages have their own dependencies
  and are not installed here.
- `.prettierrc` disables formatting inside code blocks in content files, so published
  code samples stay exactly as written.
- Removed: AstroPaper's sample posts and images, `public/default-og.jpg` (pages use the
  generated `/og.png`), FUNDING.yml, issue/PR templates, Docker and commitizen files.

## Content conventions

- Required frontmatter: `title`, `description`, `pubDatetime`, `tags`.
- Write `pubDatetime`/`modDatetime` with a time and explicit offset, e.g.
  `2025-06-08T12:00:00-05:00`. Dates are displayed in `America/Chicago`. A bare
  date or a UTC-midnight time shows as the previous day.
- Tags are lowercase kebab-case. Reuse existing tags (see `/tags/`) before adding new ones.
- Set `modDatetime` only for meaningful content updates: it shows "Updated" and moves
  the post's RSS date. Link or typo fixes don't count.
- `draft: true` and future dates hide a post in production builds, **including Vercel
  previews**. To preview a new post on a PR, leave `draft` off and use today's date.
  Merging the PR is what publishes it.
- Never rename a published post file: the filename is its URL. Published URLs are
  listed in `scripts/url-baseline.json`; add new posts there once they're live.
- Images: put them next to the post (or in `src/assets/`) and reference them relatively
  so Astro optimizes them.

## Writing and publishing articles

The pull request is the approval gate. Agents may research, draft, verify and open
PRs; **only Daniel merges an article PR**, and merging publishes it.

1. Branch `post/<slug>`; add `src/content/posts/<slug>.md` (`.mdx` only if it needs a
   component).
2. Fill in the PR template: the Sources table, the Verification log, and AI assistance.
3. Rules for drafted text:
   - Never write personal experience, opinions, anecdotes or claims about Daniel's
     work. Leave a marker instead, e.g. `[[DANIEL: what went wrong the first time?]]`.
     CI fails while any marker remains.
   - Every non-obvious factual claim needs a source in the PR's Sources table. Never
     invent or guess a citation or URL. If a source can't be found, say so in the PR.
   - Run every code sample and command before including it, and record versions and
     output in the Verification log. Mark anything that couldn't be run.
   - Match the voice of existing posts: direct, practical, first person, no hype.
4. CI must pass, and the Vercel preview gets reviewed, before merge.

## Updating AstroPaper

```bash
git fetch astro-paper --tags     # remote: https://github.com/satnaing/astro-paper.git
git merge vX.Y.Z                  # one release at a time; read its release notes first
```

Expect conflicts where upstream changes files listed above, and modify/delete conflicts
for upstream sample posts and removed files (resolve with `git rm`). Then run
`pnpm build`, `pnpm check:content`, `pnpm check:urls`, `pnpm check:links`, `pnpm lint`
and `pnpm format:check`.
