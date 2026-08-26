// This standalone Bun CLI resolves repository paths before any Effect application exists.
// oxlint-disable-next-line effecttsgo/node-builtin-import -- [EH-150] Standalone CLI resolves repository paths before any Effect application exists.
import path from "node:path";
import { runAcceptanceCommand, withAcceptanceServers } from "./acceptance-servers.ts";
import { readPackageManifest } from "./package-manifest.ts";

const monorepoRoot = path.join(import.meta.dir, ".."),
  packageManifest = await readPackageManifest(
    path.join(monorepoRoot, "packages/nearly-headless-cms/package.json"),
  ),
  packageVersionArchive = path.join(
    monorepoRoot,
    ".artifacts/npm",
    `nearly-headless-cms-${packageManifest.version}.tgz`,
  );

await runAcceptanceCommand(["bun", "run", "verify"]);
await runAcceptanceCommand(["bun", "run", "check:architecture"]);
await runAcceptanceCommand(["bun", "run", "check:generated"]);
await runAcceptanceCommand(["bun", "run", "test:types"]);
await runAcceptanceCommand(["bun", "run", "test:contract"]);
await runAcceptanceCommand(["bun", "run", "test:integration"]);
await runAcceptanceCommand(["bun", "run", "test:filesystem"]);
await runAcceptanceCommand(["bun", "test", "acceptance/journeys"]);

// oxlint-disable-next-line effecttsgo/async-function -- [EH-352] acceptance browser suites orchestrate sequential CLI commands inside server lifecycle.
await withAcceptanceServers(async () => {
  await runAcceptanceCommand(["bun", "run", "test:webview"], { ACCEPTANCE_SERVERS_READY: "1" });
  await runAcceptanceCommand(["bun", "run", "test:a11y"], { ACCEPTANCE_SERVERS_READY: "1" });
  await runAcceptanceCommand(["bun", "run", "test:visual"], { ACCEPTANCE_SERVERS_READY: "1" });
});

await runAcceptanceCommand(["bun", "run", "--cwd", "packages/nearly-headless-cms", "package:inspect"]);
await runAcceptanceCommand(["bun", "run", "--cwd", "packages/nearly-headless-cms", "build:determinism"]);
await runAcceptanceCommand(["bun", "run", "--cwd", "packages/nearly-headless-cms", "readme:verify"]);
await runAcceptanceCommand(["bun", "run", "--cwd", "packages/nearly-headless-cms", "package:smoke"], {
  PACKAGE_ARCHIVE: packageVersionArchive,
});
// oxlint-disable-next-line effecttsgo/global-console -- [EH-094] acceptance completion is intentionally emitted to CLI stdout.
console.log("\nNearly Headless CMS automated acceptance passed.");
