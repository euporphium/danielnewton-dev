# danielnewton.dev

Source for [www.danielnewton.dev](https://www.danielnewton.dev), Daniel Newton's personal
site and blog.

Built on [AstroPaper](https://github.com/satnaing/astro-paper) by Sat Naing (MIT, see
[LICENSE](LICENSE)), with Astro, Tailwind CSS and MDX. Deployed on Vercel.

```bash
pnpm install
pnpm dev          # http://localhost:4321
pnpm build        # type check, build, search index
pnpm check:urls   # confirm published URLs still resolve
```

Posts live in `src/content/posts/`. See [CLAUDE.md](CLAUDE.md) for structure, content
conventions and how theme updates are merged.
