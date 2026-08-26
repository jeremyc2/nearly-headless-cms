# CMS Builder core

This folder is the **CMS Builder core** for the Example CMS reference app. Read these files first when learning how to compose Nearly Headless CMS.

## What lives here

| Path | Purpose |
| --- | --- |
| `content/` | Content model, seed data, and definition sync |
| `api/` | Delivery (headless) and management HTTP operation declarations |
| `composition.ts` | Wires the CMS layer, command receipts, and transport options |
| `identifiers.ts` | Deterministic ID generation for acceptance tests |

## How composition works

`composition.ts` builds the reusable CMS runtime:

1. **Local development** uses `Filesystem.cms` from `nearly-headless-cms/layers`, which wires filesystem persistence plus open authorization, anonymous identity, and crypto identifiers.
2. **Acceptance tests** pass a custom `storageRoot` and swap in deterministic identifiers from `identifiers.ts`.
3. **HTTP operations** from `api/delivery/` and `api/management/` are registered on the transport layer in `server.ts`.

Replace persistence, authorization, or identity by changing how `composition.ts` builds the CMS layer. The operation declarations in `api/` and the content model in `content/` stay the same.

## Reading order

1. `content/definitions.ts` — the content model
2. `composition.ts` — how layers and routes come together
3. `api/delivery/index.ts` and `api/management/index.ts` — public HTTP surfaces
