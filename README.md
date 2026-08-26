# Nearly Headless CMS

<img width="496" height="279" alt="Nearly Headless CMS" src="https://github.com/user-attachments/assets/93b12b6f-40fc-44d5-80ef-5dd81f9b03c6" />

You want a headless CMS, but you do not want someone else's dashboard, database layout, or auth model baked in.

Nearly Headless CMS is an [Effect](https://effect.website) library that handles the CMS part: content types, entries, assets, queries, history, and HTTP APIs. You pick the storage, identity, authorization, and UI.

## Install

[`nearly-headless-cms`](https://www.npmjs.com/package/nearly-headless-cms) is published on npm. Install it with your package manager of choice, along with Effect (a peer dependency):

```sh
bun add nearly-headless-cms effect
```

```sh
pnpm add nearly-headless-cms effect
```

```sh
npm install nearly-headless-cms effect
```

Node.js 22+ and Bun 1.4+ are supported. See the [package README](packages/nearly-headless-cms/README.md) for import paths and version pins.

## Five-minute start

Describe your content, wire a layer, use the CMS service:

```ts
import { ContentDefinition, Cms } from "nearly-headless-cms";
import { InMemory } from "nearly-headless-cms/layers";
import { Effect } from "effect";

const snapshot = ContentDefinition.compileSnapshot({
  definitionSpaceId: "my-site",
  snapshotId: "v1",
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
  return yield* cms.createEntry({ contentTypeId: "note", values: { title: "Hello" } });
});

await Effect.runPromise(program.pipe(Effect.provide(cmsLayer)));
```

`InMemory.cms` is for local work and tests. Swap in filesystem storage or your own adapter when you need data to survive restarts. The CMS service interface stays the same.

## What you bring vs what the library handles

| You bring | The library handles |
| --- | --- |
| Where entries and assets are stored | Validating entries against your content types |
| Who is making a request | Creating, reading, updating, and deleting entries |
| Who is allowed to do what | Querying, pagination, and relationship expansion |
| HTTP server wiring (optional) | Entry history, definition snapshots, and migrations |
| Your admin UI and your site templates | Optional Management and Headless HTTP APIs with OpenAPI |

The library does not ship a CMS dashboard or turn content into HTML. That is your job, on purpose.

## Learn by example

Start with the smallest app, then grow into the full demo:

- **[Minimal Example CMS](apps/example-cms-minimal)** — ~120 lines of core wiring, no UI. Read [`src/core/`](apps/example-cms-minimal/src/core/) first.
- **[Example CMS](apps/example-cms)** — full reference app with a React admin UI, Management API, and Headless API. Core logic lives in [`src/core/`](apps/example-cms/src/core/); the dashboard is [`src/presentation/`](apps/example-cms/src/presentation/) (skip on first read).
- **[Public Blog](apps/public-blog)** — Astro site that reads a static export at build time. CMS integration is [`src/core/`](apps/public-blog/src/core/); templates are [`src/presentation/`](apps/public-blog/src/presentation/).

Read the step-by-step guides in the Public Blog under `/guides` when it is running locally, or browse the source in [`apps/public-blog/src/presentation/pages/guides/`](apps/public-blog/src/presentation/pages/guides/).

## Where to go next

- [Package README](packages/nearly-headless-cms/README.md) for imports, layers, HTTP transport, and stability notes
- [Minimal Example CMS README](apps/example-cms-minimal/README.md) for the smallest runnable CMS Builder app
- [Example CMS README](apps/example-cms/README.md) for running the reference admin app and APIs
- [Public Blog README](apps/public-blog/README.md) for the static site demo and build workflow
- [Guides](apps/public-blog/src/presentation/pages/guides/index.astro) for a tutorial path from content types to a live site

## Working on the library itself

Clone the repo, run `bun install --frozen-lockfile`, then `bun run verify`. Maintainer docs, acceptance strategy, and development commands live in [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](packages/nearly-headless-cms/LICENSE)
