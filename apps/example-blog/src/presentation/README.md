# Presentation

Astro templates for the Public Blog. **Skip on first read** if you are learning the CMS boundary — start in [`../core/`](../core/README.md).

This layer turns the validated public export into static HTML. It depends on core for data and types, but core never imports from here.

## Directories

| Path | Role |
| --- | --- |
| `pages/` | Routes: posts, authors, categories, tags, guides, and RSS |
| `layouts/` | Site shell and guide page wrappers |
| `components/` | Post cards, rich text, pagination, comment form |
| `styles/` | Global CSS (Tailwind entry) |

Astro reads this folder as `srcDir` (see `astro.config.ts`). Swap these files for your own framework while keeping the core export integration unchanged.
