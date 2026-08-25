# Nearly Headless CMS

<img width="496" height="279" alt="Nearly Headless CMS" src="https://github.com/user-attachments/assets/93b12b6f-40fc-44d5-80ef-5dd81f9b03c6" />

`nearly-headless-cms` is an Effect library for building a headless CMS without inheriting someone else's presentation, infrastructure, or user model.

The library owns portable content semantics and orchestration. As the CMS Builder, you compose those capabilities with the UI, persistence, identity, authorization, transport, asset management, and runtime Layers that fit your application.

## Why Nearly Headless CMS?

Most headless CMS products give you a hosted application or a fixed backend. Nearly Headless CMS gives you the reusable domain behavior needed to build your own:

- serializable Content Definitions with deterministic compilation and fingerprints;
- validated Entries, Relationships, Assets, and versioned Rich Text;
- bounded filtering, sorting, projection, expansion, and cursor pagination;
- optimistic concurrency, atomic batch mutations, Entry History, and restoration;
- versioned Definition Catalogs with compatibility checks and migration preparation;
- one typed `Cms.Service` for Management and Headless operations;
- an optional Effect HTTP transport with stable error documents, discovery, and deterministic OpenAPI 3.1 generation; and
- explicit Effect service contracts for every Builder-owned integration.

The package does not ship a CMS UI, prescribe a User model, coerce Entry values, embed presentation in content, or provide an authorization bypass.

## Install

```sh
bun add nearly-headless-cms effect
```

The portable entry points support Bun 1.4+ and Node.js 22+. `nearly-headless-cms/bun/filesystem` is intentionally Bun-only. The package is ESM-only, its declarations target TypeScript 7, and Effect is a peer dependency (`^4.0.0-rc.111`).

## Quick start

Compile a Content Definition Snapshot, compose the ready-made in-memory development Layer, and use the CMS through its public Effect service:

```ts
import { Cms, ContentDefinition } from "nearly-headless-cms";
import { DevelopmentCms } from "nearly-headless-cms/testing";
import { HttpTransport } from "nearly-headless-cms/http";
import { Effect, Layer } from "effect";

const snapshot = ContentDefinition.compile({
  definitionSpaceId: "notes",
  snapshotId: "initial",
  definitions: [
    {
      kind: "contentType",
      id: "note",
      name: "Note",
      fields: [
        {
          key: "title",
          label: "Title",
          required: true,
          kind: { kind: "text", maxLength: 120 },
        },
      ],
    },
  ],
});

const developmentCmsLayer = DevelopmentCms.layer({ snapshot });

const program = Effect.gen(function* () {
  const cms = yield* Cms.Service;

  const note = yield* cms.createEntry({
    contentTypeId: "note",
    values: { title: "Hello from Nearly Headless CMS" },
  });

  const page = yield* cms.queryEntries({
    contentTypeId: "note",
    pageSize: 20,
    where: { path: "title", operator: "startsWith", value: "Hello" },
  });

  return { note, page };
});

const result = await Effect.runPromise(program.pipe(Effect.provide(developmentCmsLayer)));
console.log(result);

// HttpTransport.layer exposes the same CMS through Effect's HTTP routing
// boundary. Provide the returned Layer to your runtime's HTTP server Layer.
const httpRoutes = HttpTransport.layer().pipe(Layer.provide(developmentCmsLayer));
void httpRoutes;
```

`DevelopmentCms` composes process-local persistence and assets, anonymous identity, open-access authorization, and cryptographic identifiers. It is intended for development, examples, and tests—not as a production security or durability configuration.

## Content Definitions

A Definition Snapshot is a complete, immutable, JSON-compatible description of one Definition Space. Compile it before constructing the CMS Layer. Compilation validates the whole snapshot atomically, resolves reusable Field Groups and Relationships, and produces a deterministic fingerprint.

Built-in Field Kinds include:

- text, integer, number, boolean, date, datetime, URL, email, enum, and JSON;
- Asset and same-space Relationship references;
- versioned Rich Text; and
- bounded lists of scalar Fields or Field Groups.

Definitions can compose reusable Field Groups inline or as nested objects. Builders can also register versioned Custom Field Kinds and Rich Text Extensions, including their validation and query capabilities.

Entry values stay JSON-compatible and are validated against the active Snapshot. Defaults are applied only during creation; the library never silently converts an invalid value into a valid one.

## The CMS service

`Cms.Service` is the single application-facing Effect service. Its operations cover:

- creating, reading, replacing, querying, deleting, and atomically mutating Entries;
- projecting Fields and expanding authorized Relationships;
- inspecting, restoring, and permanently purging Entry revisions when history is enabled;
- ingesting, reading, listing, and deleting Assets;
- reading and evolving the Definition Catalog;
- preparing and activating Definition migrations; and
- taking a consistent Snapshot of Definitions, Entries, and Assets for export.

All expected failures are typed `CmsError` values. Infrastructure Adapter causes remain encapsulated by `InfrastructureFailure`, so transport and application code do not need to understand a storage provider's private errors.

## Compose your own CMS

For production, construct the CMS with `Cms.makeLayer` and provide Layers for these public service contracts:

- `Persistence.DefinitionCatalog` and `Persistence.EntryPersistence`;
- `Asset.Management`;
- `Identity.CurrentIdentity`;
- `Authorization.Service`; and
- `Identifier.Generator`.

This boundary is deliberate: the generic CMS behavior does not know whether Entries live in PostgreSQL, SQLite, an object store, or another system, and it does not decide how a request becomes an authenticated identity.

The package includes small development Adapters under `nearly-headless-cms/adapters`:

- `MemoryDefinitionCatalog`, `MemoryEntryPersistence`, and `MemoryAssetManagement`;
- `AnonymousIdentity`;
- `AllowAllAuthorization`; and
- `CryptoIdentifierGenerator`.

### Bun filesystem persistence

`BunFilesystemPersistence.cmsLayer` supplies the Definition Catalog, Entry Persistence, and Asset Management services for one local root. It stores immutable generations and digest-addressed Asset blobs, recovers staged generations on startup, and supports `atomic` or `durable` write acknowledgement.

The filesystem Adapter assumes exactly one writer process owns a root. Network shares, synchronized folders, FUSE filesystems, externally modified roots, and multiple writers are unsupported. Configure bounded Entry, Asset, and metadata sizes for the environment in which it runs.

## HTTP transport

`nearly-headless-cms/http` provides two ways to expose a composed CMS:

- `HttpTransport.layer(options)` returns portable Effect HTTP routes to provide to the HTTP server Adapter for your runtime.
- `HttpTransport.makeHandler(options)` returns a Web-standard `Request` to `Response` handler, which is useful for serverless integration and in-memory contract tests.

The built-in Management API covers Entries, Entry History, Assets, Definitions, Snapshots, and migrations under `/api/v1/management`. The Headless API lives under `/api/v1/headless` and is composed from fixed, Builder-declared Delivery Operations. Content Clients can discover the exposed Definitions and operations at runtime and consume the generated OpenAPI 3.1 document.

Transport options include request bounds and timeouts, CORS policy, request identifier generation, Builder-specific Management Operations, and Headless Delivery Operations. Authorization still happens inside `Cms.Service`; adding an HTTP route never creates a privileged path around it.

## Public entry points

| Import | Purpose |
| --- | --- |
| `nearly-headless-cms` | `Cms`, `ContentDefinition`, `Entry`, `EntryQuery`, `EntryHistory`, `Asset`, `RichText`, `DefinitionMigration`, `Operation`, `Identity`, `Authorization`, `Persistence`, `Identifier`, `Transport`, and `CmsError` |
| `nearly-headless-cms/http` | `HttpTransport`, `HttpContract`, deterministic `OpenApi` generation, and shared HTTP types |
| `nearly-headless-cms/adapters` | In-memory persistence and assets, anonymous/open-access development Layers, and cryptographic identifiers |
| `nearly-headless-cms/bun/filesystem` | Bun-only immutable-generation filesystem persistence |
| `nearly-headless-cms/testing` | The fully composed `DevelopmentCms` Layer |

Import from these explicit entry points rather than package internals. Only the documented entry points are part of the public package contract.

## Runtime and storage boundaries

- Portable imports contain no Bun-only types and are tested as Bun and Node.js consumers.
- Content Definitions, Entry values, migration manifests, Rich Text documents, and wire representations are JSON-compatible.
- Query behavior is defined by the portable algebra and Field capabilities rather than delegated to provider-specific query semantics.
- Presentation belongs to the Content Client. The library preserves semantic data; it does not render a website or editing interface.
- Authentication supplies the current identity. Authorization separately decides whether that identity may perform a Definition-aware operation.

## Stability

The project is pre-1.0. Within the `0.1.x` line, patch releases preserve documented import paths, exported TypeScript interfaces, runtime behavior, serialized formats, HTTP contracts, and error codes. New capabilities and documented pre-1.0 breaks normally advance the next `0.y.0` and include migration guidance in the [changelog](https://github.com/jeremyc2/nearly-headless-cms/blob/main/packages/nearly-headless-cms/CHANGELOG.md).

## Learn from the reference applications

The repository contains two private reference applications that demonstrate the package boundaries without becoming part of the npm artifact:

- the [Example CMS](https://github.com/jeremyc2/nearly-headless-cms/tree/main/apps/example-cms), a React/Effect/Bun CMS Builder application; and
- the [Public Blog](https://github.com/jeremyc2/nearly-headless-cms/tree/main/apps/public-blog), an Astro Content Client that consumes only the Headless API and does not import this library.

Architecture decisions, persistence constraints, transport design, acceptance evidence, and release procedures live in the repository's [documentation](https://github.com/jeremyc2/nearly-headless-cms/tree/main/docs).

## License

[MIT](https://github.com/jeremyc2/nearly-headless-cms/blob/main/packages/nearly-headless-cms/LICENSE)
