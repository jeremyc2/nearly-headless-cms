// oxlint-disable-next-line effecttsgo/node-builtin-import -- [EH-150] Standalone CLI resolves repository paths before any Effect application exists.
import path from "node:path";
import { readPackageManifest } from "./package-manifest.ts";

const argumentIndex = 2,
  monorepoRoot = path.join(import.meta.dir, ".."),
  packageDirectory = path.join(monorepoRoot, "packages/nearly-headless-cms"),
  packageManifest = await readPackageManifest(path.join(packageDirectory, "package.json")),
  packageVersionArchive = path.join(
    monorepoRoot,
    ".artifacts/npm",
    `nearly-headless-cms-${packageManifest.version}.tgz`,
  ),
  packageInspectionReport = path.join(monorepoRoot, ".artifacts/npm/inspection.json"),
  releaseArguments = Bun.argv.slice(argumentIndex),
  releaseConfirmation = `nearly-headless-cms@${packageManifest.version}`,
  releasePublishOnly = releaseArguments.includes("--publish-only"),
  releasePublishRequested = releaseArguments.includes("--publish") || releasePublishOnly,
  releaseTag = releaseArguments.find((argument) => argument.startsWith("v")),
  run = (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-219] Bun.spawn requires a mutable string command argv.
    command: readonly string[],
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-271] spawn options include mutable environment maps.
    options?: Readonly<{
      readonly cwd?: string;
      readonly environment?: Record<string, string>;
    }>,
  ): Promise<void> =>
    Bun.write(Bun.stdout, `\n→ ${command.join(" ")}\n`).then(() => {
      const child = Bun.spawn([...command], {
        cwd: options?.cwd ?? monorepoRoot,
        env: { ...process.env, ...options?.environment },
        stderr: "inherit",
        stdout: "inherit",
      });
      return child.exited.then((exitCode) => {
        if (exitCode !== successfulExitCode) {
          throw new Error(`Release command failed: ${command.join(" ")}`);
        }
      });
    }),
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-360] release bootstrap checks awaited filesystem state before publish-only upload.
  requireVerifiedArchive = async (): Promise<void> => {
    if (!(await Bun.file(packageVersionArchive).exists())) {
      throw new Error(
        `Missing inspected archive ${packageVersionArchive}. Run \`bun run release --tag v${packageManifest.version}\` first.`,
      );
    }
    if (!(await Bun.file(packageInspectionReport).exists())) {
      throw new Error(
        `Missing inspection report ${packageInspectionReport}. Run \`bun run release --tag v${packageManifest.version}\` first.`,
      );
    }
  },
  successfulExitCode = 0;

if (releaseTag !== undefined) {
  await run(["bun", "run", "scripts/check-release-state.ts", releaseTag]);
}

if (releasePublishOnly) {
  await requireVerifiedArchive();
} else {
  await run(["bun", "run", "scripts/run-acceptance.ts"]);
  await run(["bun", "run", "scripts/record-release-evidence.ts"]);
  await run(["bun", "run", "publish:dry-run"], {
    cwd: packageDirectory,
    environment: { PACKAGE_ARCHIVE: packageVersionArchive },
  });
}

if (releasePublishRequested) {
  await run(["bun", "run", "release:npm"], {
    cwd: packageDirectory,
    environment: {
      CONFIRM_NPM_RELEASE: releaseConfirmation,
      PACKAGE_ARCHIVE: packageVersionArchive,
    },
  });
  await Bun.write(Bun.stdout, `\nPublished ${releaseConfirmation} from ${packageVersionArchive}\n`);
} else {
  await Bun.write(
    Bun.stdout,
    `\nRelease verification passed for ${releaseConfirmation}.\nPublish when ready:\n  bun run release --publish-only\n`,
  );
}
