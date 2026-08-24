# Nearly Headless CMS

`nearly-headless-cms` is a typed, ESM-only library for building headless CMS applications with Effect. It owns portable content semantics and orchestration while the CMS Builder supplies storage, identity, authorization, transport, asset, and runtime Layers.

## Install

```sh
bun add nearly-headless-cms effect
```

Portable entry points support Bun 1.4+ and Node 22+. `nearly-headless-cms/bun/filesystem` is intentionally Bun-only. Type declarations target TypeScript 7, and Effect is a peer dependency (`^4.0.0-rc.111`).

## Minimal composition

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
      fields: [{ key: "title", label: "Title", required: true, kind: { kind: "text" } }],
    },
  ],
});

const program = Effect.gen(function* () {
  const cms = yield* Cms.Service;
  return yield* cms.createEntry({ contentTypeId: "note", values: { title: "Hello" } });
});

const note = await Effect.runPromise(
  program.pipe(Effect.provide(DevelopmentCms.layer({ snapshot }))),
);
console.log(note);

// Supply this portable route Layer to HttpRouter.serve and the Effect HTTP-server
// adapter for your runtime, such as BunHttpServer or NodeHttpServer.
const httpRoutes = HttpTransport.layer().pipe(Layer.provide(DevelopmentCms.layer({ snapshot })));
void httpRoutes;
```

## Public imports

- `nearly-headless-cms` exports the named modules `Cms`, `ContentDefinition`, `Entry`, `EntryQuery`, `EntryHistory`, `Asset`, `RichText`, `DefinitionMigration`, `Operation`, `Identity`, `Authorization`, `Persistence`, `Identifier`, `Transport`, and `CmsError`.
- `nearly-headless-cms/http` exports `HttpTransport`, `HttpContract`, and deterministic `OpenApi` generation.
- `nearly-headless-cms/adapters` exports individual memory, anonymous/open-access, and crypto identifier Layers.
- `nearly-headless-cms/bun/filesystem` exports the Bun-only immutable-generation Filesystem Persistence Layer.
- `nearly-headless-cms/testing` exports only the development composition `DevelopmentCms`.

`HttpTransport.layer` declares every configured Management and Headless operation through Effect `HttpApi`, registers the implementations with Effect's HTTP router, and requires the public `Cms.Service`. The CMS Builder chooses and provides the Effect HTTP-server adapter. `HttpTransport.makeHandler` exposes the same contract as a Web-standard `Request` → `Response` handler for in-memory tests and serverless adapters. Transport limits, CORS, Delivery Operations, and Builder-specific Management Operations are configured through `HttpTransport.Options`.

```ts
import { EntryQuery, RichText } from "nearly-headless-cms";
import { HttpTransport, OpenApi } from "nearly-headless-cms/http";
import { AllowAllAuthorization, MemoryEntryPersistence } from "nearly-headless-cms/adapters";
import { BunFilesystemPersistence } from "nearly-headless-cms/bun/filesystem";
import { DevelopmentCms } from "nearly-headless-cms/testing";

void EntryQuery;
void RichText;
void HttpTransport;
void OpenApi;
void AllowAllAuthorization;
void MemoryEntryPersistence;
void BunFilesystemPersistence;
void DevelopmentCms;
```

The Filesystem Layer owns one local root and one writer process. It uses opaque logical identifiers, immutable generations, digest-addressed Asset Blobs, bounded inputs, structured corruption failures, and explicit `atomic` or `durable` acknowledgement. Network shares, synchronized folders, FUSE, externally modified roots, and multiple writers are unsupported.

Content Definitions and Entry values are JSON-compatible data. The package never coerces values, exposes CMS UI components, prescribes a User model, embeds presentation, or grants an authorization bypass. Every expected failure is typed; Adapter causes are retained only inside `InfrastructureFailure`.

## Stability

Within the `0.1.x` line, patch releases preserve explicit import paths, exported TypeScript interfaces, runtime behavior, serialized formats, HTTP contracts, and error codes. New capabilities and any documented pre-1.0 break normally advance the next `0.y.0` and include migration instructions in the changelog.

Architecture, persistence, transport, application, and acceptance decisions live in the repository’s [`docs`](https://github.com/jeremyc2/nearly-headless-cms/tree/main/docs). The Example CMS and Public Blog are private reference applications and are not part of this npm package.
