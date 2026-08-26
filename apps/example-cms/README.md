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

```
src/
  content/          What the CMS stores (definitions, seed data)
  layers/           One file per dependency wired into Cms.makeLayer
  api/
    delivery/       Headless API operations (public reads and writes)
    management/     Management API operations (editorial workflows)
    shared/         Wire schemas and command receipts
  ui/               React admin dashboard
  system.ts         Composes layers and API routes
  server.ts         Bun HTTP entrypoint
```

Each file in `layers/` exports one Effect layer. Swap `persistence.ts` for Postgres, swap `identity.ts` for your session middleware, and `Cms.Service` stays the same.

Convenience layers from `nearly-headless-cms/layers` cover the common dev case when you do not want to wire every dependency by hand.

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
