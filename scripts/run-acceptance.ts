// This standalone Bun CLI resolves repository paths before any Effect application exists.
// oxlint-disable-next-line effecttsgo/node-builtin-import -- [EH-102] Standalone CLI resolves repository paths before any Effect application exists.
import path from "node:path";
import { readPackageManifest } from "./package-manifest.ts";

const acceptanceServers: {
    exampleCms: ReturnType<typeof Bun.spawn> | undefined;
    publicBlog: ReturnType<typeof Bun.spawn> | undefined;
  } = {
    exampleCms: undefined,
    publicBlog: undefined,
  },
  monorepoRoot = path.join(import.meta.dir, ".."),
  // oxlint-disable-next-line eslint/sort-vars -- [EH-350] acceptance CMS storage path depends on the resolved monorepo root.
  acceptanceCmsStorageRoot = path.join(monorepoRoot, ".artifacts/acceptance/example-cms"),
  packageManifest = await readPackageManifest(
    path.join(monorepoRoot, "packages/nearly-headless-cms/package.json"),
  ),
  packageVersionArchive = path.join(
    monorepoRoot,
    ".artifacts/npm",
    `nearly-headless-cms-${packageManifest.version}.tgz`,
  ),
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-013] CLI command runner awaits process completion.
  run = async <Command extends readonly string[]>(
    command: Readonly<Command>,
    environment?: Readonly<Record<string, string>>,
  ): Promise<void> => {
    // oxlint-disable-next-line effecttsgo/global-console -- [EH-076] acceptance progress is intentionally emitted to CLI stdout.
    console.log(`\n→ ${command.join(" ")}`);
    const child = Bun.spawn([...command], {
      cwd: monorepoRoot,
      env: { ...process.env, ...environment },
      stderr: "inherit",
      stdout: "inherit",
    });
    if ((await child.exited) !== 0) {
      throw new Error(`Acceptance command failed: ${command.join(" ")}`);
    }
  },
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-014] CLI readiness polling requires awaited retries.
  waitFor = (requestUrl: string): Promise<void> => {
    const acceptancePollIntervalMilliseconds = 100,
      acceptanceReadinessTimeoutMilliseconds = 20_000,
      deadline = performance.now() + acceptanceReadinessTimeoutMilliseconds,
      // oxlint-disable-next-line effecttsgo/async-function -- [EH-053] recursive polling requires awaited retries.
      poll = async (): Promise<void> => {
        if (performance.now() >= deadline) {
          throw new Error(`Timed out waiting for ${requestUrl}`);
        }
        try {
          // oxlint-disable-next-line effecttsgo/global-fetch -- [EH-080] CLI acceptance polling intentionally uses the platform fetch boundary.
          const response = await fetch(requestUrl);
          if (response.ok) {
            return;
          }
        } catch {
          // Keep polling until the service becomes reachable.
        }
        await Bun.sleep(acceptancePollIntervalMilliseconds);
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
await run(["bun", "test", "acceptance/journeys"]);

await Bun.$`rm -rf ${acceptanceCmsStorageRoot}`.quiet();
await Bun.$`mkdir -p ${acceptanceCmsStorageRoot}`.quiet();

acceptanceServers.exampleCms = Bun.spawn(["bun", "run", "--cwd", "apps/example-cms", "start"], {
  cwd: monorepoRoot,
  env: { ...process.env, EXAMPLE_CMS_STORAGE_ROOT: acceptanceCmsStorageRoot },
  stderr: "inherit",
  stdout: "inherit",
});
try {
  await waitFor("http://localhost:3000/health");
  await run(["bun", "run", "--cwd", "apps/public-blog", "build"], {
    EXAMPLE_CMS_URL: "http://localhost:3000",
  });
  acceptanceServers.publicBlog = Bun.spawn(["bun", "run", "--cwd", "apps/public-blog", "start"], {
    cwd: monorepoRoot,
    stderr: "inherit",
    stdout: "inherit",
  });
  await waitFor("http://localhost:4321/");
  await waitFor("http://localhost:4321/posts/a-lighthouse-for-content/");
  await run(["bun", "run", "test:webview"], { ACCEPTANCE_SERVERS_READY: "1" });
  await run(["bun", "run", "test:a11y"], { ACCEPTANCE_SERVERS_READY: "1" });
  await run(["bun", "run", "test:visual"], { ACCEPTANCE_SERVERS_READY: "1" });
} finally {
  acceptanceServers.publicBlog?.kill();
  acceptanceServers.exampleCms.kill();
  const processes = [acceptanceServers.exampleCms.exited];
  if (acceptanceServers.publicBlog !== undefined) {
    processes.push(acceptanceServers.publicBlog.exited);
  }
  await Promise.allSettled(processes);
}

await run(["bun", "run", "--cwd", "packages/nearly-headless-cms", "package:inspect"]);
await run(["bun", "run", "--cwd", "packages/nearly-headless-cms", "build:determinism"]);
await run(["bun", "run", "--cwd", "packages/nearly-headless-cms", "readme:verify"]);
await run(["bun", "run", "--cwd", "packages/nearly-headless-cms", "package:smoke"], {
  PACKAGE_ARCHIVE: packageVersionArchive,
});
// oxlint-disable-next-line effecttsgo/global-console -- [EH-075] acceptance completion is intentionally emitted to CLI stdout.
console.log("\nNearly Headless CMS v0.1 automated acceptance passed.");
