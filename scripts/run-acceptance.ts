import { join } from "node:path";

const repository = join(import.meta.dir, ".."),
  run = async (
    command: readonly string[],
    environment: Record<string, string> = {},
  ): Promise<void> => {
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
  waitFor = async (requestUrl: string): Promise<void> => {
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      try {
        const response = await fetch(requestUrl);
        if (response.ok) {
          return;
        }
      } catch {}
      await Bun.sleep(100);
    }
    throw new Error(`Timed out waiting for ${requestUrl}`);
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
  await Promise.allSettled([
    exampleCms.exited,
    ...(publicBlog === undefined ? [] : [publicBlog.exited]),
  ]);
}

await run(["bun", "run", "--cwd", "packages/nearly-headless-cms", "package:inspect"]);
await run(["bun", "run", "--cwd", "packages/nearly-headless-cms", "build:determinism"]);
await run(["bun", "run", "--cwd", "packages/nearly-headless-cms", "readme:verify"]);
await run(["bun", "run", "--cwd", "packages/nearly-headless-cms", "package:smoke"], {
  PACKAGE_ARCHIVE: join(repository, ".artifacts/npm/nearly-headless-cms-0.1.0.tgz"),
});
console.log("\nNearly Headless CMS v0.1 automated acceptance passed.");
