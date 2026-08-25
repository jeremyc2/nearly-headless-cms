import { Effect } from "effect";
import { readPackageManifest } from "../../../scripts/package-manifest.ts";

const packageDirectory = new URL("..", import.meta.url).pathname,
  packageManifest = await readPackageManifest(`${packageDirectory}/package.json`),
  repository = new URL("../../../", import.meta.url).pathname,
  repositoryArchivePath =
    Bun.env["PACKAGE_ARCHIVE"] ??
    `${repository}.artifacts/npm/nearly-headless-cms-${packageManifest.version}.tgz`,
  successfulExitCode = 0,
  temporaryDirectoryTemplate = `${Bun.env["TMPDIR"] ?? "/tmp/"}nearly-headless-cms-consumer-XXXXXX`,
  twoSpaceIndent = 2;

if (!(await Bun.file(repositoryArchivePath).exists())) {
  throw new Error(`Package archive does not exist: ${repositoryArchivePath}`);
}

{
  const temporaryDirectoryOutput = await Bun.$`mktemp -d ${temporaryDirectoryTemplate}`.text();
  {
    const bunConsumer = `import { BunFilesystemPersistence } from "nearly-headless-cms/bun/filesystem"; console.log(Boolean(BunFilesystemPersistence.layer));\n`,
      consumerDirectory = temporaryDirectoryOutput.trim(),
      portableConsumer = `import { Cms, ContentDefinition } from "nearly-headless-cms"; import { HttpTransport } from "nearly-headless-cms/http"; import { MemoryEntryPersistence } from "nearly-headless-cms/adapters"; import { DevelopmentCms } from "nearly-headless-cms/testing"; console.log(Boolean(Cms.Service && ContentDefinition.compile && HttpTransport.makeHandler && MemoryEntryPersistence.layer && DevelopmentCms.layer));\n`,
      typeConsumer = `import { Cms, ContentDefinition } from "nearly-headless-cms"; import { HttpTransport } from "nearly-headless-cms/http"; import { MemoryEntryPersistence } from "nearly-headless-cms/adapters"; import { DevelopmentCms } from "nearly-headless-cms/testing"; void [Cms, ContentDefinition, HttpTransport, MemoryEntryPersistence, DevelopmentCms];\n`;
    await Bun.write(
      `${consumerDirectory}/package.json`,
      `${JSON.stringify(
        {
          dependencies: {
            effect: "4.0.0-rc.111",
            "nearly-headless-cms": `file:${repositoryArchivePath}`,
            typescript: "7.0.2",
          },
          private: true,
          type: "module",
        },
        null,
        twoSpaceIndent,
      )}\n`,
    );
    await Bun.write(`${consumerDirectory}/portable.mjs`, portableConsumer);
    await Bun.write(`${consumerDirectory}/filesystem.mjs`, bunConsumer);
    await Bun.write(`${consumerDirectory}/consumer.ts`, typeConsumer);
    await Bun.write(
      `${consumerDirectory}/tsconfig.json`,
      `${JSON.stringify(
        {
          compilerOptions: {
            module: "NodeNext",
            moduleResolution: "NodeNext",
            noEmit: true,
            skipLibCheck: true,
            strict: true,
            target: "ES2023",
          },
          include: ["consumer.ts"],
        },
        null,
        twoSpaceIndent,
      )}\n`,
    );
    {
      const installProcess = Bun.spawn(["bun", "install", "--ignore-scripts"], {
        cwd: consumerDirectory,
        stderr: "inherit",
        stdout: "inherit",
      });
      if ((await installProcess.exited) !== successfulExitCode) {
        throw new Error("Clean consumer installation failed");
      }
    }
    {
      const commands = [
          ["bun", "portable.mjs"],
          ["node", "portable.mjs"],
          ["bun", "filesystem.mjs"],
          ["bunx", "tsc", "-p", "tsconfig.json"],
        ],
        executions = commands.map((command) => ({
          command,
          exitCode: Bun.spawn(command, {
            cwd: consumerDirectory,
            stderr: "inherit",
            stdout: "inherit",
          }).exited,
        })),
        results = await Promise.all(
          executions.map(({ command, exitCode }) =>
            exitCode.then((resolvedExitCode) => ({ command, resolvedExitCode })),
          ),
        );
      for (const { command, resolvedExitCode } of results) {
        if (resolvedExitCode !== successfulExitCode) {
          throw new Error(`Clean consumer smoke failed: ${command.join(" ")}`);
        }
      }
    }
  }
}

await Effect.runPromise(Effect.log(`Package smoke passed for ${repositoryArchivePath}`));
