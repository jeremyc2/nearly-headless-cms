// oxlint-disable-next-line effecttsgo/node-builtin-import -- [EH-102] Standalone CLI resolves repository paths before any Effect application exists.
import path from "node:path";
import { readPackageManifest } from "./package-manifest.ts";

const effectVersion = "4.0.0-rc.111",
  monorepoRoot = path.join(import.meta.dir, ".."),
  packageManifest = await readPackageManifest(
    path.join(monorepoRoot, "packages/nearly-headless-cms/package.json"),
  ),
  // oxlint-disable-next-line eslint/sort-vars -- [EH-258] archive path depends on the resolved package manifest version.
  packageArchivePath = path.join(
    monorepoRoot,
    ".artifacts/npm",
    `nearly-headless-cms-${packageManifest.version}.tgz`,
  ),
  portableConsumer = `import { Cms, ContentDefinition } from "nearly-headless-cms"; import { HttpTransport } from "nearly-headless-cms/http"; import { MemoryEntryPersistence } from "nearly-headless-cms/adapters"; import { DevelopmentCms } from "nearly-headless-cms/testing"; console.log(Boolean(Cms.Service && ContentDefinition.compile && HttpTransport.makeHandler && MemoryEntryPersistence.layer && DevelopmentCms.layer));\n`,
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-013] CLI command runner awaits process completion.
  runCommand = async (command: readonly string[], workingDirectory: string): Promise<void> => {
    const child = Bun.spawn([...command], {
      cwd: workingDirectory,
      stderr: "inherit",
      stdout: "inherit",
    });
    if ((await child.exited) !== 0) {
      throw new Error(`Package portability command failed: ${command.join(" ")}`);
    }
  },
  runtimes = [
    { command: ["bun", "--version"], label: "bun" },
    { command: ["node", "--version"], label: "node" },
  ] as const,
  temporaryDirectoryResponse =
    await Bun.$`mktemp -d ${monorepoRoot}/.artifacts/package-portability-XXXXXX`.text(),
  trimmedDirectory = temporaryDirectoryResponse.trim(),
  twoSpaceIndent = 2;

await Promise.all(runtimes.map((runtime) => runCommand(runtime.command, monorepoRoot)));
await Bun.write(
  `${trimmedDirectory}/package.json`,
  `${JSON.stringify(
    {
      dependencies: {
        effect: effectVersion,
        "nearly-headless-cms": `file:${packageArchivePath}`,
        typescript: "7.0.2",
      },
      private: true,
      type: "module",
    },
    null,
    twoSpaceIndent,
  )}\n`,
);
await Bun.write(`${trimmedDirectory}/portable.mjs`, portableConsumer);
await runCommand(["bun", "install", "--ignore-scripts"], trimmedDirectory);
await runCommand(["bun", "portable.mjs"], trimmedDirectory);
await runCommand(["node", "portable.mjs"], trimmedDirectory);
await Bun.write(Bun.stdout, "Package portability smoke test passed.\n");
