# Minimal Example CMS

The smallest runnable CMS Builder app in this repository.

No admin UI. No generated clients. Just content definitions, two Delivery Queries, filesystem persistence, and an HTTP server.

Use this when you want to understand the core wiring before opening the full [Example CMS](../example-cms).

## Run it

From the repository root:

```sh
bun run --cwd apps/example-cms-minimal dev
```

Open [http://localhost:3001/api/v1/headless/notes](http://localhost:3001/api/v1/headless/notes). Set `EXAMPLE_CMS_MINIMAL_PORT` to use another port.

## Start here

Read these files in order:

1. [`src/core/definitions.ts`](src/core/definitions.ts) — your Content Types
2. [`src/core/delivery.ts`](src/core/delivery.ts) — public Headless Delivery Queries
3. [`src/core/composition.ts`](src/core/composition.ts) — `Filesystem.cms` + HTTP transport
4. [`src/server.ts`](src/server.ts) — Bun entrypoint and seed data

That is the entire CMS Builder surface for this app (~120 lines).

## What is intentionally missing

| Full Example CMS | This app |
| --- | --- |
| React admin UI | None — use the Management API from the full app or your own UI |
| Management operations | Headless reads only |
| Blog content model | Single `note` Content Type |
| OpenAPI client codegen | Call the Headless API with `curl` or any HTTP client |

## Next steps

- [Example CMS](../example-cms) adds a reference admin UI and the blog Headless/Management contracts
- [Package README](../../packages/nearly-headless-cms/README.md) documents the library imports
- [Public Blog](../public-blog) shows a static Content Client reading the full app's Headless API
