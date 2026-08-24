import { BunHttpServer, BunRuntime } from "@effect/platform-bun";
import { Effect, Layer, Schema } from "effect";
import { HttpRouter, HttpServerResponse, HttpStaticServer } from "effect/unstable/http";
import tailwind from "bun-plugin-tailwind";
import { HttpTransport } from "nearly-headless-cms/http";
import { join } from "node:path";
import { seed } from "./domain/seed.ts";
import { makeExampleComposition } from "./system.ts";

class DashboardBuildFailure extends Schema.TaggedError<DashboardBuildFailure>()(
  "DashboardBuildFailure",
  { message: Schema.String },
) {}

const applicationDirectory = join(import.meta.dir, ".."),
  dashboardDirectory = join(applicationDirectory, "dist"),
  port = Number(Bun.env["EXAMPLE_CMS_PORT"] ?? "3000"),
  responseFrom = (response: Response) => HttpServerResponse.fromWeb(response),
  composition = makeExampleComposition({ seed: true }),
  applicationRoutes = Layer.mergeAll(
    HttpTransport.layer(composition.transportOptions),
    Layer.effectDiscard(seed),
    Layer.effectDiscard(
      HttpRouter.HttpRouter.pipe(
        Effect.flatMap((router) =>
          Effect.gen(function* registerRoutes() {
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
  ).pipe(Layer.provide(composition.cmsLayer)),
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
    catch: (cause) =>
      cause instanceof DashboardBuildFailure
        ? cause
        : DashboardBuildFailure.make({
            message: cause instanceof Error ? cause.message : "Dashboard build failed",
          }),
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
        throw DashboardBuildFailure.make({
          message: result.logs.map((log) => log.message).join("\n"),
        });
      }
    },
  });

BunRuntime.runMain(buildDashboard.pipe(Effect.andThen(Layer.launch(server))));
