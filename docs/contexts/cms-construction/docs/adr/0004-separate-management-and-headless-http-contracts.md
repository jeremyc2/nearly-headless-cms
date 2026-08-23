# Separate Management and Headless HTTP contracts

Nearly Headless CMS hosts a complete generic Management API separately from a narrower CMS Builder-defined Headless API, using ordinary versioned HTTP/OpenAPI rather than a public RPC protocol or unrestricted generic CRUD. This prevents open-access identity from exposing authoring data and lets Content Clients use app-local generated bindings without importing the CMS, reusable library, or a shared SDK.

## Consequences

- CMS-specific Delivery Queries and Commands make publication, moderation, and safe public mutation constraints explicit.
- Dynamic Content Definitions use runtime discovery and fingerprint preconditions while composed routes remain stable.
- The Effect v4 `HttpApi` implementation remains replaceable behind a stable wire contract.

## Alternatives considered

- **One generic API for CMS and Content Clients**: smaller transport surface, but cannot safely express published-only reads or server-owned Comment fields when Authorization neither rewrites queries nor encodes workflow.
- **Public Effect RPC**: strong procedure typing, but imposes a custom envelope and is poorly suited to resource-oriented Asset delivery and non-Effect clients.
- **Shared runtime SDK**: convenient for TypeScript consumers, but violates the Public Blog's independent Headless API boundary and couples clients to package releases.
