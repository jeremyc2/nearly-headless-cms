# Example Blog CMS

SQL-backed Headless CMS reference for the Example Blog static site.

This app demonstrates:

- **Kysely + SQLite** persistence (swap to Postgres/RDS via `DATABASE_URL`)
- **JWT authentication** with Cognito-style group claims (development HS256 tokens locally)
- **Local filesystem asset blobs** standing in for S3 object storage
- **Management UI** for editorial workflows
- **Headless API** consumed at build time by [Example Blog](../example-blog)

## Run locally

From the repository root:

```sh
# Terminal 1: start the CMS
bun run --cwd apps/example-blog-cms dev

# Terminal 2: build and serve the static blog
bun run --cwd apps/example-blog build
bun run --cwd apps/example-blog start
```

| URL | Purpose |
| --- | --- |
| `http://localhost:3001` | React management dashboard |
| `http://localhost:3001/api/v1/management` | Editorial API (requires `cms-editor` JWT) |
| `http://localhost:3001/api/v1/headless` | Build-time API (requires `headless-reader` JWT) |
| `http://localhost:4322` | Static Example Blog after build |

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `file:.data/example-blog-cms/cms.sqlite` | SQL connection string |
| `EXAMPLE_BLOG_CMS_PORT` | `3001` | CMS HTTP port |
| `EXAMPLE_BLOG_CMS_JWT_SECRET` | dev secret | HS256 signing key (replace with Cognito JWKS in production) |
| `EXAMPLE_BLOG_CMS_ASSET_ROOT` | `.data/example-blog-cms/assets` | Local blob store (replace with S3 adapter) |
| `EXAMPLE_BLOG_SERVICE_TOKEN` | fetched from `/development/token/headless` | Service principal JWT for blog builds |

Development token endpoints (local only):

- `GET /development/token/editor` — dashboard JWT (`cms-editor` group)
- `GET /development/token/headless` — build service JWT (`headless-reader` group)
- `POST /development/rebuild` — triggers Example Blog static build

## Architecture notes

Entry queries still evaluate in memory over a loaded generation — SQL stores generations, it does not translate the Entry Query algebra. That is intentional for v0.1 and matches the library contract.

Asset metadata lives in SQL; bytes live in the local blob directory. Production swaps the blob layer for S3 (`src/core/assets/s3-asset-blob-store-reference.ts`).
