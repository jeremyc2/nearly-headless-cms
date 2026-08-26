# Example CMS

A full CMS Builder reference app for the Public Blog demo.

You get a React admin UI, a Management API for editing, and a Headless API for public reads. All three run from one Bun server. This is sample code: copy what helps, replace what does not.

## Run it locally

From the repository root:

```sh
bun run --cwd apps/example-cms dev
```

Open [http://localhost:3000](http://localhost:3000). The dev server creates `.data/example-cms`, seeds demo content on first run, and keeps serving until you stop it.

Set `EXAMPLE_CMS_PORT` to use a different port.

## What you get

| URL | Purpose |
| --- | --- |
| `/` | React management UI for posts, authors, assets, and comments |
| `/api/v1/management` | Editorial API used by the dashboard |
| `/api/v1/headless` | Public API used by the Public Blog at build time |
| `/health` | Health check for local tooling |

The app uses filesystem persistence and open authorization (every request is anonymous and allowed). Fine for a demo. Not a production auth setup.

## How the code is organized

The source tree separates **CMS Builder core** from **reference presentation**:

```
src/
  core/             CMS Builder core — read this first
    content/        Content model, seed data, definition sync
    api/            Delivery and management HTTP operation declarations
    composition.ts  CMS layer and transport wiring
    identifiers.ts  Deterministic IDs for acceptance tests
  presentation/     Reference React admin UI — skip on first read
    index.html      Browser entrypoint
    main.tsx        React bootstrap
    …               Dashboard pages and entry editor
  generated/        Auto-generated OpenAPI clients — do not edit
  server.ts         Bun HTTP entrypoint
```

### Reading order

1. **`core/`** — Start with `core/README.md`, then `content/definitions.ts` and `composition.ts`. This is what you copy when building your own CMS.
2. **`presentation/`** — Optional reference UI. See `presentation/README.md` if you want a working admin dashboard example.
3. **`generated/`** — Typed HTTP clients regenerated from OpenAPI specs. See `generated/README.md`.

Local development uses `Filesystem.cms` from `nearly-headless-cms/layers`, which wires filesystem persistence with open authorization, anonymous identity, and crypto identifiers. Swap any piece in `core/composition.ts` without changing `Cms.Service`.

## Pair with the Public Blog

The [Public Blog](../public-blog) reads from this app's Headless API. Typical workflow:

```sh
# Terminal 1
bun run --cwd apps/example-cms dev

# Terminal 2
bun run --cwd apps/public-blog build
bun run --cwd apps/public-blog start
```

Edit content in the dashboard, rebuild the blog, and the static site picks up the new export.

## Learn the library without reading every file

The Public Blog ships step-by-step guides at `/guides` when you run it locally. Same ideas as this app, written for someone who has not opened the source yet.

For library API details, see the [package README](../../packages/nearly-headless-cms/README.md).
