# Example Blog

100% static Content Client for [Example Blog CMS](../example-blog-cms).

Build time downloads a public export from the Headless API using a service principal JWT. Runtime serving is plain static files — no CMS dependency on the public internet.

## Run the demo

```sh
# Terminal 1
bun run --cwd apps/example-blog-cms dev

# Terminal 2
bun run --cwd apps/example-blog build
bun run --cwd apps/example-blog start
```

Open [http://localhost:4322](http://localhost:4322).

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `EXAMPLE_BLOG_CMS_URL` | `http://localhost:3001` | Headless API base URL |
| `EXAMPLE_BLOG_SERVICE_TOKEN` | fetched from CMS dev endpoint | JWT with `headless-reader` group |
| `EXAMPLE_BLOG_PORT` | `4322` | Static site preview port |

No comment submission, no runtime API calls — everything is resolved at build time.
