import { BunHttpServer, BunRuntime } from "@effect/platform-bun";
import { HttpRouter, HttpStaticServer } from "effect/unstable/http";
import { Layer } from "effect";

const port = Number(Bun.env.PUBLIC_BLOG_PORT ?? "4321"),
  serverStaticFilesLayer = HttpStaticServer.layer({
    index: "index.html",
    root: `${import.meta.dir}/../dist`,
    spa: false,
  }),
  serverWithStaticFilesLayer = HttpRouter.serve(serverStaticFilesLayer).pipe(
    Layer.provide(BunHttpServer.layer({ port })),
  );
BunRuntime.runMain(Layer.launch(serverWithStaticFilesLayer));
