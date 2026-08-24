import { BunHttpServer, BunRuntime } from "@effect/platform-bun";
import { Effect, Layer, Schema } from "effect";
import { HttpRouter, HttpServerResponse, HttpStaticServer } from "effect/unstable/http";
import { DashboardBuildFailure } from "./dashboard-build-failure.ts";
import { HttpTransport } from "nearly-headless-cms/http";
import { makeExampleComposition } from "./system.ts";
import { seed } from "./domain/seed.ts";
import tailwind from "bun-plugin-tailwind";

const applicationBaseDirectory = new URL("..", import.meta.url).pathname,
  applicationDashboardDirectory = `${applicationBaseDirectory}/dist`,
  applicationDashboardEntrypoint = `${applicationBaseDirectory}/src/index.html`,
  applicationDashboardIndexPath = `${applicationDashboardDirectory}/index.html`,
  applicationPort = Number(Bun.env["EXAMPLE_CMS_PORT"] ?? "3000"),
  composition = makeExampleComposition({ seed: true }),
  failureFreeExitCode = 0,
  failureResponseStatus = 500,
  redirectResponseStatus = 302,
  responseFrom = (response: Response): HttpServerResponse.HttpServerResponse =>
    HttpServerResponse.fromWeb(response),
  responseRebuildFailure = (cause: unknown): HttpServerResponse.HttpServerResponse => {
    if (cause instanceof Error) {
      return responseFrom(new Response(cause.message, { status: failureResponseStatus }));
    }
    return responseFrom(new Response("Build failed", { status: failureResponseStatus }));
  },
  responseRebuildPublicBlog: Effect.Effect<HttpServerResponse.HttpServerResponse> = Effect.try({
    catch: responseRebuildFailure,
    try: () =>
      Bun.spawn(["bun", "run", "build"], {
        cwd: `${import.meta.dir}/../../public-blog`,
        env: {
          ...Bun.env,
          EXAMPLE_CMS_URL: `http://localhost:${applicationPort}`,
        },
        stderr: "pipe",
        stdout: "pipe",
      }),
  }).pipe(
    Effect.flatMap((buildProcess) =>
      Effect.tryPromise({
        catch: responseRebuildFailure,
        try: () => buildProcess.exited,
      }).pipe(Effect.map((exitCode) => ({ buildProcess, exitCode }))),
    ),
    Effect.flatMap(({ buildProcess, exitCode }) => {
      if (exitCode === failureFreeExitCode) {
        return Effect.succeed(HttpServerResponse.text("Public Blog build completed"));
      }
      return Effect.tryPromise({
        catch: responseRebuildFailure,
        try: () => new Response(buildProcess.stderr).text(),
      }).pipe(
        Effect.map((stderrText) =>
          responseFrom(new Response(stderrText, { status: failureResponseStatus })),
        ),
      );
    }),
    Effect.match({
      onFailure: (error) => error,
      onSuccess: (response) => response,
    }),
  ),
  routeApplicationEffect = HttpRouter.HttpRouter.pipe(
    Effect.flatMap((router) =>
      Effect.gen(function* registerRoutes() {
        yield* router.add(
          "POST",
          "/development/rebuild",
          (): typeof responseRebuildPublicBlog => responseRebuildPublicBlog,
        );
        yield* router.add(
          "GET",
          "/docs/headless",
          responseFrom(Response.redirect("/api/v1/headless/openapi.json", redirectResponseStatus)),
        );
        yield* router.add(
          "GET",
          "/docs/management",
          responseFrom(
            Response.redirect("/api/v1/management/openapi.json", redirectResponseStatus),
          ),
        );
        yield* router.add("GET", "/health", HttpServerResponse.text("ok"));
      }),
    ),
  ),
  routeApplicationLayer = Layer.mergeAll(
    HttpTransport.layer(composition.transportOptions),
    Layer.effectDiscard(seed),
    Layer.effectDiscard(routeApplicationEffect),
  ).pipe(Layer.provide(composition.cmsLayer)),
  routeDashboardFallbackEffect = HttpRouter.HttpRouter.pipe(
    Effect.flatMap((router) =>
      Effect.gen(function* registerDashboardHistoryFallbacks() {
        const dashboardShell = (): ReturnType<typeof HttpServerResponse.file> =>
          HttpServerResponse.file(applicationDashboardIndexPath, {
            headers: { "content-type": "text/html; charset=utf-8" },
          });
        yield* router.add("GET", "/assets", dashboardShell);
        yield* router.add("GET", "/content/*", dashboardShell);
      }),
    ),
  ),
  routeDashboardFallbackLayer = Layer.effectDiscard(routeDashboardFallbackEffect),
  routeStaticDashboardLayer = HttpStaticServer.layer({
    index: "index.html",
    root: applicationDashboardDirectory,
    spa: true,
  }),
  serverLayer = HttpRouter.serve(
    Layer.mergeAll(routeApplicationLayer, routeDashboardFallbackLayer, routeStaticDashboardLayer),
  ).pipe(
    Layer.provide(
      BunHttpServer.layer({
        development: Bun.env.NODE_ENV !== "production",
        port: applicationPort,
      }),
    ),
  ),
  serverLayerLaunch = Layer.launch(serverLayer),
  zBuildDashboard = Effect.tryPromise({
    catch: (cause) => {
      if (Schema.is(DashboardBuildFailure)(cause)) {
        return cause;
      }
      if (cause instanceof Error) {
        return DashboardBuildFailure.make({ message: cause.message });
      }
      return DashboardBuildFailure.make({ message: "Dashboard build failed" });
    },
    try: () =>
      Bun.build({
        entrypoints: [applicationDashboardEntrypoint],
        minify: Bun.env.NODE_ENV === "production",
        outdir: applicationDashboardDirectory,
        plugins: [tailwind],
        publicPath: "/",
        sourcemap: "linked",
        splitting: true,
        target: "browser",
      }).then((result) => {
        const { logs, success } = result;
        if (!success) {
          throw DashboardBuildFailure.make({
            message: logs.map((log) => log.message).join("\n"),
          });
        }
      }),
  });

BunRuntime.runMain(zBuildDashboard.pipe(Effect.andThen(serverLayerLaunch)));
