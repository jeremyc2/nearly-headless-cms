# Example CMS

Reference composition of Nearly Headless CMS for the Example Blog.

## Layout

```
src/
  content/          # What the CMS stores (definitions, seed data)
  layers/           # One file per dependency provided to Cms.makeLayer
  api/
    delivery/       # Headless (public) HTTP operations
    management/     # Editorial HTTP operations
    shared/         # Wire schemas and command receipts
  ui/               # React management dashboard
  system.ts         # Wires layers + API into a runnable system
  server.ts         # Bun HTTP server entrypoint
```

## Swapping a layer

Each file in `layers/` exports a single Effect layer. Replace any file with your own implementation as long as it satisfies the same service contract. The CMS service itself stays unchanged.

Convenience layers are also available from `nearly-headless-cms/layers` when you want a pre-wired composition for development or filesystem persistence.

## Guides

The Public Blog includes a [Guides](/guides/) section that walks through the same ideas with code examples.
