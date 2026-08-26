# Core

CMS integration for the Public Blog. **Read these files first** when learning how this site talks to the Headless API.

This layer downloads and validates the public export, loads it at build time, and exposes typed helpers for routes and templates. It does not import `nearly-headless-cms` — only the generated OpenAPI client and export JSON.

## Files

| Path | Role |
| --- | --- |
| `fetch-export.ts` | Downloads the public export and assets from the Headless API before Astro builds |
| `fetch-export-failure.ts` | Typed failure for export download errors |
| `data/public-export.ts` | Loads `.generated/public-export.json` and lookup maps for authors, tags, and assets |
| `domain/public-model.ts` | Pure helpers: published posts, pagination, sorted guides |
| `domain/archive-pages.ts` | Astro `getStaticPaths` builders for paginated archives |
| `generated/` | OpenAPI client for the Headless API (generated; do not edit by hand) |

## Build-time flow

1. `fetch-export.ts` calls the Example CMS Headless API (or installs the committed fixture when `PUBLIC_BLOG_USE_FIXTURE=1`).
2. Output lands in `.generated/public-export.json` and `public/generated-assets/`.
3. `data/public-export.ts` decodes that snapshot when Astro collects pages.

Presentation templates import from here via `../core/...` paths. Keep CMS-facing logic in this folder so you can swap the Astro layer without touching the export contract.
