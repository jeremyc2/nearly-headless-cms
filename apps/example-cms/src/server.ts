import { BunRuntime } from "@effect/platform-bun";
import { Effect } from "effect";
import dashboard from "./index.html";
import { createExampleSystem } from "./system.ts";

const port = Number(Bun.env["EXAMPLE_CMS_PORT"] ?? "3000"),
  server = Effect.acquireRelease(
    Effect.tryPromise({
      catch: (cause) => cause,
      try: async () => {
        const system = await createExampleSystem({ seed: true });
        const bunServer = Bun.serve({
          development: Bun.env.NODE_ENV !== "production",
          port,
          routes: {
            "/*": dashboard,
            "/api/*": async (request) => system.handler(request),
            "/development/rebuild": async (request) => {
              if (request.method !== "POST") {
                return new Response("Method not allowed", { status: 405 });
              }
              const build = Bun.spawn(["bun", "run", "build"], {
                cwd: `${import.meta.dir}/../../public-blog`,
                env: { ...Bun.env, EXAMPLE_CMS_URL: `http://localhost:${port}` },
                stderr: "pipe",
                stdout: "pipe",
              });
              const exitCode = await build.exited;
              if (exitCode !== 0) {
                return new Response(await new Response(build.stderr).text(), { status: 500 });
              }
              return new Response("Public Blog build completed", {
                headers: { "content-type": "text/plain" },
              });
            },
            "/docs/headless": Response.redirect("/api/v1/headless/openapi.json", 302),
            "/docs/management": Response.redirect("/api/v1/management/openapi.json", 302),
            "/health": new Response("ok", { headers: { "content-type": "text/plain" } }),
          },
        });
        console.log(`Example CMS listening at ${bunServer.url}`);
        return { bunServer, system };
      },
    }),
    ({ bunServer, system }) =>
      Effect.promise(async () => {
        await bunServer.stop(true);
        await system.dispose();
      }),
  );

BunRuntime.runMain(Effect.scoped(server.pipe(Effect.andThen(Effect.never))));
