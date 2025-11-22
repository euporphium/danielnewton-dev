# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workspace Overview

This is an Nx monorepo using pnpm as the package manager. The repository contains a personal website/blog built with Astro.

**Key Technologies:**
- Nx 21.1.2 for monorepo management
- Astro 5.x for static site generation
- Tailwind CSS v4 for styling
- TypeScript for type safety
- MDX for blog content

## Project Structure

```
apps/
  web/               # Main Astro website/blog
    src/
      components/    # Astro components (Header, Footer, BaseHead, etc.)
      content/       # Content collections (blog posts)
      layouts/       # Page layouts (BlogPost)
      pages/         # Astro pages and routes
      styles/        # Global styles
    astro.config.mjs # Astro configuration
libs/                # Currently empty, reserved for shared libraries
```

## Common Commands

**Development:**
```bash
# Start dev server for web app
pnpm nx dev web

# Build web app for production
pnpm nx build web

# Preview production build
pnpm nx preview web

# Type checking (currently disabled due to tsconfig settings)
pnpm nx typecheck web
```

**Nx Commands:**
```bash
# Run any target for a project
pnpm nx <target> <project-name>

# Visualize project graph
pnpm nx graph

# Sync TypeScript project references
pnpm nx sync

# Check if TypeScript references are in sync (for CI)
pnpm nx sync:check
```

**Code Quality:**
```bash
# Format code with Prettier (Astro + Tailwind plugins)
pnpm prettier --write .
```

## Architecture Notes

**Content Collections:**
- Blog posts are stored in `apps/web/src/content/blog/` as Markdown/MDX files
- Content schema is defined in `apps/web/src/content.config.ts` using Zod
- Schema includes: title, description, pubDate, updatedDate (optional)
- Uses Astro's glob loader for content collection

**Routing:**
- File-based routing in `apps/web/src/pages/`
- Main routes: `/` (home), `/blog/` (blog index), `/projects/`, `/privacy/`
- Dynamic blog post routes handled via Astro's content collections
- RSS feed generated at `/rss.xml`
- Robots.txt generated at `/robots.txt`

**Styling:**
- Tailwind CSS v4 integrated via Vite plugin
- Prettier configured with tailwindcss plugin for class sorting
- Typography plugin enabled for markdown content

**Analytics & Tracking:**
- PostHog integration (see `components/posthog.astro`)
- Vercel Speed Insights enabled
- Cookie consent component (`components/CookieConsent.astro`)

**SEO:**
- Sitemap generation via `@astrojs/sitemap`
- Site URL: https://www.danielnewton.dev
- BaseHead component handles meta tags, Open Graph, and canonical URLs

## Development Workflow

**Adding Blog Posts:**
1. Create new `.md` or `.mdx` file in `apps/web/src/content/blog/`
2. Include required frontmatter: title, description, pubDate
3. Optionally add updatedDate for content updates
4. Content will be automatically picked up by the glob loader

**Nx Integration:**
- All scripts are wrapped with `nx exec` for proper task orchestration
- Nx manages task caching and dependencies
- Project type is marked as "library" (not "application") in Nx metadata

## Important Files

- `apps/web/src/consts.ts` - Site metadata and global constants
- `apps/web/astro.config.mjs` - Astro configuration (MDX, sitemap integrations)
- `pnpm-workspace.yaml` - Workspace package configuration
- `.prettierrc` - Code formatting rules