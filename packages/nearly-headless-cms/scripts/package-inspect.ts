import { Effect } from "effect";
import { readPackageManifest } from "../../../scripts/package-manifest.ts";

const allowedTopLevel = new Set([
    "package/package.json",
    "package/README.md",
    "package/LICENSE",
    "package/CHANGELOG.md",
  ]),
  workspace = new URL("..", import.meta.url).pathname,
  workspaceManifest = await readPackageManifest(`${workspace}/package.json`),
  successfulExitCode = 0,
  twoSpaceIndent = 2,
  workspaceArchiveDirectory = new URL("../../../.artifacts/npm/", import.meta.url).pathname,
  workspaceArchiveName = `nearly-headless-cms-${workspaceManifest.version}.tgz`,
  workspaceArchivePath = `${workspaceArchiveDirectory}${workspaceArchiveName}`;

await Bun.$`mkdir -p ${workspaceArchiveDirectory}`.quiet();
await Bun.$`rm -f ${workspaceArchivePath}`.quiet();

{
  const packProcess = Bun.spawn(
    [
      "bun",
      "pm",
      "pack",
      "--destination",
      workspaceArchiveDirectory,
      "--ignore-scripts",
      "--quiet",
    ],
    { cwd: workspace, stderr: "inherit", stdout: "pipe" },
  );
  if ((await packProcess.exited) !== successfulExitCode) {
    throw new Error("bun pm pack failed");
  }
  {
    const listProcess = Bun.spawn(["tar", "-tzf", workspaceArchivePath], {
        stderr: "inherit",
        stdout: "pipe",
      }),
      listProcessText = await new Response(listProcess.stdout).text(),
      listProcessTextEntries = listProcessText
        .trim()
        .split("\n")
        .filter((entry) => entry.length > successfulExitCode)
        .toSorted(),
      modeProcess = Bun.spawn(["tar", "-tvzf", workspaceArchivePath], {
        stderr: "inherit",
        stdout: "pipe",
      }),
      modeProcessText = await new Response(modeProcess.stdout).text();
    if ((await listProcess.exited) !== successfulExitCode) {
      throw new Error("Unable to list npm archive");
    }
    if ((await modeProcess.exited) !== successfulExitCode) {
      throw new Error("Unable to inspect npm archive modes");
    }
    for (const entry of listProcessTextEntries) {
      if (
        entry.startsWith("/") ||
        entry.includes("../") ||
        entry.includes("\\") ||
        (!allowedTopLevel.has(entry) &&
          !/^package\/dist\/.+\.(?:js|d\.ts|js\.map|d\.ts\.map)$/u.test(entry))
      ) {
        throw new Error(`Unexpected npm archive entry: ${entry}`);
      }
    }
    if (modeProcessText.split("\n").some((line) => line.startsWith("l"))) {
      throw new Error("npm archive contains a symbolic link");
    }
    if (new Set(listProcessTextEntries).size !== listProcessTextEntries.length) {
      throw new Error("npm archive contains duplicate paths");
    }
    for (const requiredEntry of allowedTopLevel) {
      if (!listProcessTextEntries.includes(requiredEntry)) {
        throw new Error(`npm archive is missing ${requiredEntry}`);
      }
    }
    {
      const archiveBytes = new Uint8Array(await Bun.file(workspaceArchivePath).arrayBuffer()),
        archiveHasher = new Bun.CryptoHasher("sha256"),
        report = {
          archivePath: workspaceArchivePath,
          byteLength: archiveBytes.byteLength,
          entries: listProcessTextEntries,
          entryCount: listProcessTextEntries.length,
          package: "nearly-headless-cms",
          sha256: "",
          version: workspaceManifest.version,
        };
      archiveHasher.update(archiveBytes);
      report.sha256 = archiveHasher.digest("hex");
      await Bun.write(
        `${workspaceArchiveDirectory}inspection.json`,
        `${JSON.stringify(report, null, twoSpaceIndent)}\n`,
      );
      await Effect.runPromise(Effect.log(JSON.stringify(report, null, twoSpaceIndent)));
    }
  }
}
