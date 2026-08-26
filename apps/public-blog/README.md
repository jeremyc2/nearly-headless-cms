# Public Blog

A static Content Client for the Example CMS demo.

This site renders posts, authors, categories, and tags from a JSON export. It calls the Headless API at build time and does not import `nearly-headless-cms`. That separation is the point: your public site should not depend on CMS library internals.

## Run the full demo

You need the Example CMS running first.

```sh
# Terminal 1: start the CMS
bun run --cwd apps/example-cms dev

# Terminal 2: build and serve this site
bun run --cwd apps/public-blog build
bun run --cwd apps/public-blog start
```

Open [http://localhost:4321](http://localhost:4321). Set `PUBLIC_BLOG_PORT` to change the port.

The build reads from `EXAMPLE_CMS_URL`, which defaults to `http://localhost:3000`.

## What happens at build time

1. `src/fetch-export.ts` downloads a validated public export and asset files from the Headless API.
2. Astro writes static HTML from `.generated/public-export.json`.
3. You deploy plain files. No Node server required for reading posts.

Comment submission is the one feature that calls the API at runtime.

## Why static?

Posts and taxonomy change when editors publish, not on every page view. A build-time snapshot keeps hosting cheap and proves the Headless API is a clean boundary between CMS and site.

Your stack can differ. This demo uses Astro and Tailwind. The contract that matters is the export shape from the Headless API, not these template files.

## Guides

Browse [http://localhost:4321/guides/](http://localhost:4321/guides/) when the site is running locally.

The guides walk from installing the library to defining content, wiring layers, and building a site like this one. Source lives in `src/pages/guides/`.

## Project layout

```
src/
  fetch-export.ts       Downloads the public export before Astro builds
  pages/                Routes, including /guides for the tutorial
  layouts/              Site and guide page shells
  components/           Post cards, rich text rendering, pagination
  generated/            OpenAPI client for the Headless API (generated)
.generated/             Build-time export JSON and fetched assets (gitignored)
```

## Related docs

- [Example CMS README](../example-cms/README.md) for the CMS this site reads from
- [Package README](../../packages/nearly-headless-cms/README.md) for the library the CMS is built with
- [Repository README](../../README.md) for the monorepo overview
