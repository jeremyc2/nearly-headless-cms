import { createHash } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

const workspace = join(import.meta.dir, ".."),
  repository = join(workspace, "..", ".."),
  artifactDirectory = join(repository, ".artifacts", "npm"),
  archiveName = "nearly-headless-cms-0.1.0.tgz",
  archivePath = join(artifactDirectory, archiveName);
await mkdir(artifactDirectory, { recursive: true });
await rm(archivePath, { force: true });

const pack = Bun.spawn(
  ["bun", "pm", "pack", "--destination", artifactDirectory, "--ignore-scripts", "--quiet"],
  { cwd: workspace, stderr: "inherit", stdout: "pipe" },
);
if ((await pack.exited) !== 0) {
  throw new Error("bun pm pack failed");
}

const list = Bun.spawn(["tar", "-tzf", archivePath], { stderr: "inherit", stdout: "pipe" }),
  entries = (await new Response(list.stdout).text()).trim().split("\n").filter(Boolean).sort();
if ((await list.exited) !== 0) {
  throw new Error("Unable to list npm archive");
}
const detailedList = Bun.spawn(["tar", "-tvzf", archivePath], {
    stderr: "inherit",
    stdout: "pipe",
  }),
  details = await new Response(detailedList.stdout).text();
if ((await detailedList.exited) !== 0) {
  throw new Error("Unable to inspect npm archive modes");
}

const allowedTopLevel = new Set([
  "package/package.json",
  "package/README.md",
  "package/LICENSE",
  "package/CHANGELOG.md",
]);
for (const entry of entries) {
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
if (details.split("\n").some((line) => line.startsWith("l"))) {
  throw new Error("npm archive contains a symbolic link");
}
if (new Set(entries).size !== entries.length) {
  throw new Error("npm archive contains duplicate paths");
}
for (const required of allowedTopLevel) {
  if (!entries.includes(required)) throw new Error(`npm archive is missing ${required}`);
}

const archiveBytes = new Uint8Array(await Bun.file(archivePath).arrayBuffer()),
  report = {
    archivePath,
    byteLength: archiveBytes.byteLength,
    entries,
    entryCount: entries.length,
    package: "nearly-headless-cms",
    sha256: createHash("sha256").update(archiveBytes).digest("hex"),
    version: "0.1.0",
  };
await Bun.write(join(artifactDirectory, "inspection.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
