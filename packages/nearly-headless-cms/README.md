# Nearly Headless CMS

<img width="496" height="279" alt="Nearly Headless CMS" src="https://github.com/user-attachments/assets/93b12b6f-40fc-44d5-80ef-5dd81f9b03c6" />

Most headless CMS products give you a hosted app with fixed storage and auth. This library gives you the CMS behavior and lets you plug in your own.

You are the **CMS Builder**. You choose the database, the login flow, the admin UI, and the public site. The library validates content, runs queries, stores history, and can expose HTTP APIs when you want them.

## Install

```sh
bun add nearly-headless-cms effect
```

Requirements:

- Effect `^4.0.0-rc.111` (peer dependency)
- Bun 1.4+ or Node.js 22+
- TypeScript 7 for the published types
- ESM only

`nearly-headless-cms/bun/filesystem` is Bun-only. Everything else is portable.

## Quick start

```ts
import { ContentDefinition, Cms } from "nearly-headless-cms";
import { InMemory } from "nearly-headless-cms/layers";
import { Effect } from "effect";

const snapshot = ContentDefinition.compileSnapshot({
  definitionSpaceId: "notes",
  snapshotId: "initial",
  definitions: [
    ContentDefinition.Fields.contentType({
      id: "note",
      name: "Note",
      fields: [
        ContentDefinition.Fields.requiredTextField("title", "Title", { maxLength: 120 }),
      ],
    }),
  ],
});

const cmsLayer = InMemory.cms({ snapshot });

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

await Effect.runPromise(program.pipe(Effect.provide(cmsLayer)));
```

`InMemory.cms` wires process-local storage, anonymous identity, open authorization, and crypto identifiers. Fine for development and tests. Not a production security or durability setup.

## Define content in TypeScript

Content types are plain TypeScript objects. Compile them once into an immutable snapshot:

```ts
import { ContentDefinition } from "nearly-headless-cms";

const { compileSnapshot, Fields } = ContentDefinition;

const snapshot = compileSnapshot({
  definitionSpaceId: "my-site",
  snapshotId: "v1",
  definitions: [
    Fields.contentType({
      id: "post",
      name: "Post",
      fields: [
        Fields.requiredTextField("title", "Title", { maxLength: 180 }),
        Fields.requiredSlugField("slug", "Slug"),
        { key: "body", kind: { kind: "rich-text", formatVersion: 1 }, label: "Body", required: true },
      ],
    }),
  ],
});
```

Built-in field kinds cover text, numbers, dates, enums, assets, relationships, rich text, and lists. The compiler checks the whole snapshot and produces a stable fingerprint.

## Wire your dependencies

The CMS service needs persistence, asset storage, identity, authorization, and ID generation from your app.

For local work, use a convenience layer:

```ts
import { ContentDefinition } from "nearly-headless-cms";
import { InMemory } from "nearly-headless-cms/layers";

const snapshot = ContentDefinition.compileSnapshot({
  definitionSpaceId: "notes",
  snapshotId: "initial",
  definitions: [],
});

const cmsLayer = InMemory.cms({ snapshot });
```

For disk-backed storage, use `Filesystem.cms` from `nearly-headless-cms/layers` with a root path and your compiled snapshot. For production, call `Cms.makeLayer` and provide your own layers.

The [Example CMS](https://github.com/jeremyc2/nearly-headless-cms/tree/main/apps/example-cms) shows a full composition with filesystem storage, delivery operations, and a React admin UI.

## Expose HTTP when you need it

After you compose a CMS layer, mount the HTTP transport:

```ts
import { ContentDefinition } from "nearly-headless-cms";
import { HttpTransport } from "nearly-headless-cms/http";
import { InMemory } from "nearly-headless-cms/layers";
import { Layer } from "effect";

const snapshot = ContentDefinition.compileSnapshot({
  definitionSpaceId: "notes",
  snapshotId: "initial",
  definitions: [],
});

const cmsLayer = InMemory.cms({ snapshot });
const httpRoutes = HttpTransport.layer().pipe(Layer.provide(cmsLayer));

void httpRoutes;
```

The Management API covers editorial work under `/api/v1/management`. The Headless API lives under `/api/v1/headless` for public reads and writes you declare explicitly.

A **Content Client** (your blog, app, or static site generator) calls the Headless API without importing this library.

Authorization still runs inside `Cms.Service`. Adding a route does not create a back door.

## Declare Delivery Queries with less boilerplate

Use `DeliveryRecipes` from `nearly-headless-cms/http` to derive Definition Requirements from your Snapshot, project public Entry values, and declare common Headless routes:

```ts
import { Schema } from "effect";
import { DeliveryRecipes } from "nearly-headless-cms/http";

const noteRequirement = DeliveryRecipes.definitionRequirementFromContentType(snapshot, "note", {
  projectableOnly: true,
});

const listNotes = DeliveryRecipes.paginatedDeliveryQuery({
  contentTypeId: "note",
  definitionRequirements: [noteRequirement],
  identifier: "listNotes",
  path: "/notes",
  reachableContentTypeIds: ["note"],
  request: Schema.Struct({}),
  response: Schema.Struct({ items: Schema.Array(Schema.Unknown) }),
  pageQuery: Schema.Struct({ cursor: Schema.optionalKey(Schema.String) }),
});
```

See [`apps/example-cms-minimal`](https://github.com/jeremyc2/nearly-headless-cms/tree/main/apps/example-cms-minimal) for a complete minimal app using these helpers.

## Public imports

| Import | Use it for |
| --- | --- |
| `nearly-headless-cms` | `Cms`, `ContentDefinition`, `Entry`, `EntryQuery`, `Asset`, `RichText`, and service contracts |
| `nearly-headless-cms/layers` | `InMemory`, `Filesystem`, and shared dev dependencies |
| `nearly-headless-cms/http` | HTTP transport, contracts, OpenAPI generation, and `DeliveryRecipes` helpers |
| `nearly-headless-cms/adapters` | In-memory persistence, anonymous identity, open authorization |
| `nearly-headless-cms/bun/filesystem` | Bun-only filesystem persistence |
| `nearly-headless-cms/testing` | Fully composed `DevelopmentCms` layer |

Import from these paths only. Undocumented internals are not part of the public contract.

## Learn more

- [Guides](https://github.com/jeremyc2/nearly-headless-cms/tree/main/apps/public-blog/src/presentation/pages/guides) walk from first layer to a static site
- [Minimal Example CMS README](https://github.com/jeremyc2/nearly-headless-cms/blob/main/apps/example-cms-minimal/README.md) for the smallest runnable app
- [Example CMS README](https://github.com/jeremyc2/nearly-headless-cms/blob/main/apps/example-cms/README.md) for a runnable reference app
- [Public Blog README](https://github.com/jeremyc2/nearly-headless-cms/blob/main/apps/public-blog/README.md) for the static site demo
- [Repository README](https://github.com/jeremyc2/nearly-headless-cms) for the monorepo overview
- [CONTRIBUTING.md](https://github.com/jeremyc2/nearly-headless-cms/blob/main/CONTRIBUTING.md) for maintainers cloning the repo

## Stability

Pre-1.0. Within `0.1.x`, patch releases preserve documented import paths, serialized formats, HTTP contracts, and error codes. Breaking changes advance `0.y.0` with notes in the [changelog](CHANGELOG.md).

## License

[MIT](LICENSE)
