// oxlint-disable-next-line effecttsgo/node-builtin-import -- [EH-150] Standalone CLI resolves repository paths before any Effect application exists.
import path from "node:path";

export interface AcceptanceServers {
  readonly exampleCms: ReturnType<typeof Bun.spawn>;
  readonly publicBlog: ReturnType<typeof Bun.spawn>;
}

export const monorepoRoot = path.join(import.meta.dir, "..");
export const acceptanceCmsStorageRoot = path.join(monorepoRoot, ".artifacts/acceptance/example-cms");
const exampleCmsDirectory = path.join(monorepoRoot, "apps/example-cms"),
  publicBlogDirectory = path.join(monorepoRoot, "apps/public-blog");

const acceptancePollIntervalMilliseconds = 100,
  acceptanceReadinessTimeoutMilliseconds = 20_000;

// oxlint-disable-next-line effecttsgo/async-function -- [EH-016] CLI readiness polling requires awaited retries.
export const waitForAcceptanceService = (requestUrl: string): Promise<void> => {
  const deadline = performance.now() + acceptanceReadinessTimeoutMilliseconds,
    // oxlint-disable-next-line effecttsgo/async-function -- [EH-062] recursive polling requires awaited retries.
    poll = async (): Promise<void> => {
      if (performance.now() >= deadline) {
        throw new Error(`Timed out waiting for ${requestUrl}`);
      }
      try {
        // oxlint-disable-next-line effecttsgo/global-fetch -- [EH-100] CLI acceptance polling intentionally uses the platform fetch boundary.
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

// oxlint-disable-next-line effecttsgo/async-function, effecttsgo/missing-pipeable-signature -- [EH-353, EH-356] acceptance CLI command runner awaits process completion and is not a pipeable Effect API.
export const runAcceptanceCommand = async <Command extends readonly string[]>(
  command: Readonly<Command>,
  environment?: Readonly<Record<string, string>>,
): Promise<void> => {
  // oxlint-disable-next-line effecttsgo/global-console -- [EH-095] acceptance progress is intentionally emitted to CLI stdout.
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
};

// oxlint-disable-next-line effecttsgo/async-function -- [EH-350] acceptance servers require awaited process startup.
export const startAcceptanceServers = async (): Promise<AcceptanceServers> => {
  await Bun.$`rm -rf ${acceptanceCmsStorageRoot}`.quiet();
  await Bun.$`mkdir -p ${acceptanceCmsStorageRoot}`.quiet();
  const exampleCms = Bun.spawn(["bun", "src/server.ts"], {
    cwd: exampleCmsDirectory,
    env: {
      ...process.env,
      EXAMPLE_CMS_STORAGE_ROOT: acceptanceCmsStorageRoot,
      NODE_ENV: "production",
    },
    stderr: "ignore",
    stdout: "ignore",
  });
  await waitForAcceptanceService("http://localhost:3000/health");
  await runAcceptanceCommand(["bun", "run", "--cwd", "apps/public-blog", "build"], {
    EXAMPLE_CMS_URL: "http://localhost:3000",
  });
  const publicBlog = Bun.spawn(["bun", "src/server.ts"], {
    cwd: publicBlogDirectory,
    stderr: "ignore",
    stdout: "ignore",
  });
  await waitForAcceptanceService("http://localhost:4321/");
  await waitForAcceptanceService("http://localhost:4321/posts/a-lighthouse-for-content/");
  return { exampleCms, publicBlog };
};

// oxlint-disable-next-line effecttsgo/async-function, typescript/prefer-readonly-parameter-types -- [EH-354, EH-357] acceptance servers require awaited process shutdown and Bun.spawn handles are mutable platform types.
export const stopAcceptanceServers = async (servers: Readonly<AcceptanceServers>): Promise<void> => {
  servers.publicBlog.kill("SIGTERM");
  servers.exampleCms.kill("SIGTERM");
  await Promise.allSettled([servers.exampleCms.exited, servers.publicBlog.exited]);
};

// oxlint-disable-next-line effecttsgo/async-function, typescript/prefer-readonly-parameter-types -- [EH-358, EH-359] acceptance lifecycle wraps awaited server startup and teardown; callback types are not deeply readonly.
export const withAcceptanceServers = async <Result>(work: () => Promise<Result>): Promise<Result> => {
  const servers = await startAcceptanceServers();
  try {
    return await work();
  } finally {
    await stopAcceptanceServers(servers);
  }
};
