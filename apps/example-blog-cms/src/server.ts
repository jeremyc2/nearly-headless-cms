import { BunHttpServer, BunRuntime } from "@effect/platform-bun";
import { Effect, Layer, Schema } from "effect";
import { HttpRouter, HttpServerResponse, HttpStaticServer } from "effect/unstable/http";
import { DashboardBuildFailure } from "./dashboard-build-failure.ts";
import { authenticatedHttpTransportLayer } from "./core/auth/auth-http-transport-layer.ts";
import {
  cmsEditorGroup,
  defaultEditorDevelopmentToken,
  defaultHeadlessServiceToken,
} from "./core/auth/auth-jwt.ts";
import { developmentIdentityFromSubject, identityStorage } from "./core/auth/auth-request-identity.ts";
import { makeSeededExampleBlogCmsCompositionFromEnvironment } from "./core/composition.ts";
import { seed } from "./core/content/seed.ts";
import { syncDefinition } from "./core/content/sync-definition.ts";
import tailwind from "bun-plugin-tailwind";

const applicationBaseDirectory = new URL("..", import.meta.url).pathname,
  applicationDashboardDirectory = `${applicationBaseDirectory}/dist`,
  applicationDashboardEntrypoint = `${applicationBaseDirectory}/src/presentation/index.html`,
  applicationDashboardIndexPath = `${applicationDashboardDirectory}/index.html`,
  applicationPort = Number(Bun.env["EXAMPLE_BLOG_CMS_PORT"] ?? "3001"),
  composition = makeSeededExampleBlogCmsCompositionFromEnvironment(),
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
  responseRebuildExampleBlog: Effect.Effect<HttpServerResponse.HttpServerResponse> = Effect.gen(
    function* rebuildExampleBlog() {
      const serviceToken = yield* Effect.tryPromise({
        catch: responseRebuildFailure,
        try: () =>
          Bun.env["EXAMPLE_BLOG_SERVICE_TOKEN"] === undefined
            ? defaultHeadlessServiceToken()
            : Promise.resolve(Bun.env["EXAMPLE_BLOG_SERVICE_TOKEN"]),
      });
      const buildProcess = yield* Effect.try({
        catch: responseRebuildFailure,
        try: () =>
          Bun.spawn(["bun", "run", "build"], {
            cwd: `${import.meta.dir}/../../example-blog`,
            env: {
              ...Bun.env,
              EXAMPLE_BLOG_CMS_URL: `http://localhost:${applicationPort}`,
              EXAMPLE_BLOG_SERVICE_TOKEN: serviceToken,
            },
            stderr: "pipe",
            stdout: "pipe",
          }),
      });
      const exitCode = yield* Effect.tryPromise({
        catch: responseRebuildFailure,
        try: () => buildProcess.exited,
      });
      if (exitCode === failureFreeExitCode) {
        return HttpServerResponse.text("Example Blog build completed");
      }
      const stderrText = yield* Effect.tryPromise({
        catch: responseRebuildFailure,
        try: () => new Response(buildProcess.stderr).text(),
      });
      return responseFrom(new Response(stderrText, { status: failureResponseStatus }));
    },
  ).pipe(
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
          (): typeof responseRebuildExampleBlog => responseRebuildExampleBlog,
        );
        yield* router.add("GET", "/development/token/editor", () =>
          Effect.tryPromise({
            catch: () => responseFrom(new Response("Token issue failed", { status: 500 })),
            try: () =>
              defaultEditorDevelopmentToken().then((token) =>
                responseFrom(Response.json({ token })),
              ),
          }),
        );
        yield* router.add("GET", "/development/token/headless", () =>
          Effect.tryPromise({
            catch: () => responseFrom(new Response("Token issue failed", { status: 500 })),
            try: () =>
              defaultHeadlessServiceToken().then((token) =>
                responseFrom(Response.json({ token })),
              ),
          }),
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
    authenticatedHttpTransportLayer(composition.transportOptions),
    Layer.effectDiscard(
      Effect.gen(function* runExampleBlogCmsStartup() {
        yield* Effect.sync(() => {
          identityStorage.enterWith(
            developmentIdentityFromSubject("example-blog-cms-startup", [cmsEditorGroup]),
          );
        });
        yield* syncDefinition;
        yield* seed;
      }),
    ),
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
