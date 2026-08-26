import { BunHttpServer, BunRuntime } from "@effect/platform-bun";
import { Cms } from "nearly-headless-cms";
import { HttpTransport } from "nearly-headless-cms/http";
import { Effect, Layer } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/unstable/http";
import { makeMinimalComposition } from "./core/composition.ts";
import { definitionSnapshot } from "./core/definitions.ts";

const port = Number(Bun.env["EXAMPLE_CMS_MINIMAL_PORT"] ?? "3001"),
  composition = makeMinimalComposition(),
  seedNote = Effect.gen(function* seedNoteEffect() {
    const cms = yield* Cms.Service,
      existing = yield* cms.queryEntries({ contentTypeId: "note", pageSize: 1 });
    if (existing.items.length > 0) {
      return yield* Effect.void;
    }
    yield* cms.createEntry({
      contentTypeId: "note",
      values: {
        body: "This note was seeded by the minimal Example CMS on first startup.",
        slug: "hello-minimal",
        title: "Hello from the minimal Example CMS",
      },
    });
    return yield* Effect.log(`Seeded note for ${definitionSnapshot.fingerprint}`);
  }),
  routeApplicationLayer = Layer.mergeAll(
    HttpTransport.layer(composition.transportOptions),
    Layer.effectDiscard(seedNote),
    Layer.effectDiscard(
      HttpRouter.HttpRouter.pipe(
        Effect.flatMap((router) => router.add("GET", "/health", HttpServerResponse.text("ok"))),
      ),
    ),
  ).pipe(Layer.provide(composition.cmsLayer)),
  serverLayer = HttpRouter.serve(routeApplicationLayer).pipe(
    Layer.provide(
      BunHttpServer.layer({
        development: Bun.env.NODE_ENV !== "production",
        port,
      }),
    ),
  );

BunRuntime.runMain(Layer.launch(serverLayer));
