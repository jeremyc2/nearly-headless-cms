// oxlint-disable-next-line effecttsgo/node-builtin-import -- [EH-102] Standalone CLI resolves repository paths before any Effect application exists.
import path from "node:path";

const effectVersion = "4.0.0-rc.111",
  monorepoRoot = path.join(import.meta.dir, ".."),
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-013] CLI command runner awaits process completion.
  runCommand = async (command: readonly string[], workingDirectory: string): Promise<void> => {
    const child = Bun.spawn([...command], {
      cwd: workingDirectory,
      stderr: "inherit",
      stdout: "inherit",
    });
    if ((await child.exited) !== 0) {
      throw new Error(`Compatibility command failed: ${command.join(" ")}`);
    }
  },
  runtimes = [
    { command: ["bun", "--version"], label: "bun" },
    { command: ["node", "--version"], label: "node" },
  ] as const,

 temporaryDirectoryResponse =
  await Bun.$`mktemp -d ${monorepoRoot}/.artifacts/compatibility-XXXXXX`.text(),
 trimmedDirectory = temporaryDirectoryResponse.trim();

await Promise.all(runtimes.map((runtime) => runCommand(runtime.command, monorepoRoot)));
await runCommand(["bun", "install", `effect@${effectVersion}`, "typescript@7.0.2"], trimmedDirectory);
await runCommand(
  ["bun", "install", path.join(monorepoRoot, ".artifacts/npm/nearly-headless-cms-0.1.0.tgz")],
  trimmedDirectory,
);
await Bun.write(
  `${trimmedDirectory}/verify-import.ts`,
  'import * as NearlyHeadlessCms from "nearly-headless-cms";\nif (NearlyHeadlessCms.Cms === undefined) { throw new Error("missing Cms export"); }\n',
);
await runCommand(["bun", "verify-import.ts"], trimmedDirectory);
await Bun.write(Bun.stdout, "Compatibility matrix passed.\n");
