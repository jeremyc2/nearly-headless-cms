# Generated OpenAPI clients

This folder contains **auto-generated OpenAPI clients** for the Example CMS HTTP APIs.

**Do not edit files here.** Regenerate them when the delivery or management operation contracts change.

| File | Purpose |
| --- | --- |
| `headless-openapi-client*.ts` | Low-level client for the headless (delivery) API |
| `management-openapi-client*.ts` | Low-level client for the management API |
| `management-client.ts` | Hand-written convenience wrapper around the management client |
| `*-failure.ts` | Shared transport and protocol error types |

The reference admin UI in `../presentation/` imports from `management-client.ts`. External consumers like the Public Blog use the headless client at build time.
