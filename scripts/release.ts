// oxlint-disable-next-line effecttsgo/node-builtin-import
import path from "node:path";

interface PackageManifest {
  readonly version: string;
}

const argumentIndex = 2,
 repository = path.join(import.meta.dir, ".."),
 packageDirectory = path.join(repository, "packages/nearly-headless-cms"),
 packageManifest = (await Bun.file(path.join(packageDirectory, "package.json")).json()) as PackageManifest,
 releaseArguments = Bun.argv.slice(argumentIndex),
 publishRequested = releaseArguments.includes("--publish"),
 releaseTag = releaseArguments.find((argument) => argument.startsWith("v")),
 packageArchive = path.join(
  repository,
  ".artifacts/npm",
  `nearly-headless-cms-${packageManifest.version}.tgz`,
),
 releaseConfirmation = `nearly-headless-cms@${packageManifest.version}`,
 successfulExitCode = 0,

 run = (
  command: readonly string[],
  options: {
    readonly cwd?: string;
    readonly environment?: Record<string, string>;
  } = {},
): Promise<void> =>
  Bun.write(Bun.stdout, `\n→ ${command.join(" ")}\n`).then(() => {
    const child = Bun.spawn([...command], {
      cwd: options.cwd ?? repository,
      env: { ...process.env, ...options.environment },
      stderr: "inherit",
      stdout: "inherit",
    });
    return child.exited.then((exitCode) => {
      if (exitCode !== successfulExitCode) {
        throw new Error(`Release command failed: ${command.join(" ")}`);
      }
    });
  });

if (releaseTag !== undefined) {
  await run(["bun", "run", "scripts/check-release-state.ts", releaseTag]);
}

await run(["bun", "run", "scripts/run-acceptance.ts"]);
await run(["bun", "run", "publish:dry-run"], {
  cwd: packageDirectory,
  environment: { PACKAGE_ARCHIVE: packageArchive },
});

if (publishRequested) {
  await run(["bun", "run", "release:npm"], {
    cwd: packageDirectory,
    environment: {
      CONFIRM_NPM_RELEASE: releaseConfirmation,
      PACKAGE_ARCHIVE: packageArchive,
    },
  });
  await Bun.write(Bun.stdout, `\nPublished ${releaseConfirmation} from ${packageArchive}\n`);
} else {
  await Bun.write(
    Bun.stdout,
    `\nRelease verification passed for ${releaseConfirmation}.\nPublish when ready:\n  bun run release --publish\n`,
  );
}
