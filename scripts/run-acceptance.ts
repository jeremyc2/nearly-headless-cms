// This standalone Bun CLI resolves repository paths before any Effect application exists.
// oxlint-disable-next-line effecttsgo/node-builtin-import
import path from "node:path";

const repository = path.join(import.meta.dir, ".."),
  // oxlint-disable-next-line effecttsgo/async-function -- CLI command runner awaits process completion.
  run = async (
    command: readonly string[],
    environment: Record<string, string> = {},
  ): Promise<void> => {
    // oxlint-disable-next-line effecttsgo/global-console -- acceptance progress is intentionally emitted to CLI stdout.
    console.log(`\n→ ${command.join(" ")}`);
    const child = Bun.spawn(command, {
      cwd: repository,
      env: { ...process.env, ...environment },
      stderr: "inherit",
      stdout: "inherit",
    });
    if ((await child.exited) !== 0) {
      throw new Error(`Acceptance command failed: ${command.join(" ")}`);
    }
  },
  // oxlint-disable-next-line effecttsgo/async-function -- CLI readiness polling requires awaited retries.
  waitFor = async (requestUrl: string): Promise<void> => {
    const deadline = performance.now() + 20_000,
     // oxlint-disable-next-line effecttsgo/async-function -- recursive polling requires awaited retries.
     poll = async (): Promise<void> => {
      if (performance.now() >= deadline) {
        throw new Error(`Timed out waiting for ${requestUrl}`);
      }
      try {
        // oxlint-disable-next-line effecttsgo/global-fetch -- CLI acceptance polling intentionally uses the platform fetch boundary.
        const response = await fetch(requestUrl);
        if (response.ok) {
          return;
        }
      } catch {
        // Keep polling until the service becomes reachable.
      }
      await Bun.sleep(100);
      return poll();
    };
    return poll();
  };

await run(["bun", "run", "verify"]);
await run(["bun", "run", "check:architecture"]);
await run(["bun", "run", "check:generated"]);
await run(["bun", "run", "test:types"]);
await run(["bun", "run", "test:contract"]);
await run(["bun", "run", "test:integration"]);
await run(["bun", "run", "test:filesystem"]);

const exampleCms = Bun.spawn(["bun", "run", "--cwd", "apps/example-cms", "start"], {
  cwd: repository,
  stderr: "inherit",
  stdout: "inherit",
});
let publicBlog: ReturnType<typeof Bun.spawn> | undefined;
try {
  await waitFor("http://localhost:3000/health");
  await run(["bun", "run", "--cwd", "apps/public-blog", "build"]);
  publicBlog = Bun.spawn(["bun", "run", "--cwd", "apps/public-blog", "start"], {
    cwd: repository,
    stderr: "inherit",
    stdout: "inherit",
  });
  await waitFor("http://localhost:4321/");
  await run(["bun", "run", "test:webview"], { ACCEPTANCE_SERVERS_READY: "1" });
  await run(["bun", "run", "test:visual"], { ACCEPTANCE_SERVERS_READY: "1" });
} finally {
  publicBlog?.kill();
  exampleCms.kill();
  const processes = [exampleCms.exited];
  if (publicBlog !== undefined) {
    processes.push(publicBlog.exited);
  }
  await Promise.allSettled(processes);
}

await run(["bun", "run", "--cwd", "packages/nearly-headless-cms", "package:inspect"]);
await run(["bun", "run", "--cwd", "packages/nearly-headless-cms", "build:determinism"]);
await run(["bun", "run", "--cwd", "packages/nearly-headless-cms", "readme:verify"]);
await run(["bun", "run", "--cwd", "packages/nearly-headless-cms", "package:smoke"], {
  PACKAGE_ARCHIVE: path.join(repository, ".artifacts/npm/nearly-headless-cms-0.1.0.tgz"),
});
// oxlint-disable-next-line effecttsgo/global-console -- acceptance completion is intentionally emitted to CLI stdout.
console.log("\nNearly Headless CMS v0.1 automated acceptance passed.");
