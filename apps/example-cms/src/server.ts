import { BunHttpServer, BunRuntime } from "@effect/platform-bun";
import { Effect, Layer } from "effect";
import {
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
  HttpStaticServer,
} from "effect/unstable/http";
import tailwind from "bun-plugin-tailwind";
import { join } from "node:path";
import { createExampleSystem } from "./system.ts";

const applicationDirectory = join(import.meta.dir, ".."),
  dashboardDirectory = join(applicationDirectory, "dist"),
  port = Number(Bun.env["EXAMPLE_CMS_PORT"] ?? "3000"),
  responseFrom = (response: Response) => HttpServerResponse.fromWeb(response),
  applicationRoutes = Layer.effectDiscard(
    Effect.acquireRelease(
      Effect.promise(() => createExampleSystem({ seed: true })),
      (system) => Effect.promise(() => system.dispose()),
    ).pipe(
      Effect.flatMap((system) =>
        HttpRouter.HttpRouter.pipe(
          Effect.flatMap((router) =>
            Effect.gen(function* registerRoutes() {
              yield* router.add("*", "/api/*", (request) =>
                HttpServerRequest.toWeb(request).pipe(
                  Effect.flatMap((webRequest) => Effect.promise(() => system.handler(webRequest))),
                  Effect.map(responseFrom),
                ),
              );
              yield* router.add("POST", "/development/rebuild", () =>
                Effect.tryPromise({
                  catch: (cause) =>
                    responseFrom(
                      new Response(cause instanceof Error ? cause.message : "Build failed", {
                        status: 500,
                      }),
                    ),
                  try: async () => {
                    const buildProcess = Bun.spawn(["bun", "run", "build"], {
                        cwd: `${import.meta.dir}/../../public-blog`,
                        env: {
                          ...Bun.env,
                          EXAMPLE_CMS_URL: `http://localhost:${port}`,
                        },
                        stderr: "pipe",
                        stdout: "pipe",
                      }),
                      exitCode = await buildProcess.exited;
                    if (exitCode !== 0) {
                      return responseFrom(
                        new Response(await new Response(buildProcess.stderr).text(), {
                          status: 500,
                        }),
                      );
                    }
                    return HttpServerResponse.text("Public Blog build completed");
                  },
                }).pipe(Effect.catch((response) => Effect.succeed(response))),
              );
              yield* router.add(
                "GET",
                "/docs/headless",
                responseFrom(Response.redirect("/api/v1/headless/openapi.json", 302)),
              );
              yield* router.add(
                "GET",
                "/docs/management",
                responseFrom(Response.redirect("/api/v1/management/openapi.json", 302)),
              );
              yield* router.add("GET", "/health", HttpServerResponse.text("ok"));
            }),
          ),
        ),
      ),
    ),
  ),
  staticDashboard = HttpStaticServer.layer({
    index: "index.html",
    root: dashboardDirectory,
    spa: true,
  }),
  server = HttpRouter.serve(Layer.mergeAll(applicationRoutes, staticDashboard)).pipe(
    Layer.provide(
      BunHttpServer.layer({
        development: Bun.env.NODE_ENV !== "production",
        port,
      }),
    ),
  ),
  buildDashboard = Effect.tryPromise({
    catch: (cause) => (cause instanceof Error ? cause : new Error("Dashboard build failed")),
    try: async () => {
      const result = await Bun.build({
        entrypoints: [join(applicationDirectory, "src", "index.html")],
        minify: Bun.env.NODE_ENV === "production",
        outdir: dashboardDirectory,
        plugins: [tailwind],
        sourcemap: "linked",
        splitting: true,
        target: "browser",
      });
      if (!result.success) {
        throw new Error(result.logs.map((log) => log.message).join("\n"));
      }
    },
  });

BunRuntime.runMain(buildDashboard.pipe(Effect.andThen(Layer.launch(server))));
