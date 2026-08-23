import { BunHttpServer, BunRuntime } from "@effect/platform-bun";
import { Layer } from "effect";
import { HttpRouter, HttpStaticServer } from "effect/unstable/http";
import { join } from "node:path";

const port = Number(Bun.env.PUBLIC_BLOG_PORT ?? "4321"),
  staticFiles = HttpStaticServer.layer({
    index: "index.html",
    root: join(import.meta.dir, "..", "dist"),
    spa: false,
  }),
  server = HttpRouter.serve(staticFiles).pipe(Layer.provide(BunHttpServer.layer({ port })));
BunRuntime.runMain(Layer.launch(server));
