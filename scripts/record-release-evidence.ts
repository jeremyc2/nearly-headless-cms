// oxlint-disable-next-line effecttsgo/node-builtin-import -- [EH-150] Standalone CLI resolves repository paths before any Effect application exists.
import path from "node:path";
import { readArchiveChecksum } from "./record-release-evidence-support.ts";
import { readPackageManifest } from "./package-manifest.ts";

const artifactsDirectory = path.join(import.meta.dir, "..", ".artifacts/npm"),
 monorepoRoot = path.join(import.meta.dir, ".."),
 packageManifest = await readPackageManifest(
  path.join(monorepoRoot, "packages/nearly-headless-cms/package.json"),
 ),
 archivePath = path.join(artifactsDirectory, `nearly-headless-cms-${packageManifest.version}.tgz`),
 branchText = await Bun.$`git rev-parse --abbrev-ref HEAD`.cwd(monorepoRoot).text(),
 branch = branchText.trim(),
 bunVersion = Bun.version,
 commitText = await Bun.$`git rev-parse HEAD`.cwd(monorepoRoot).text(),
 commit = commitText.trim(),
 evidenceJsonIndent = 2,
 generatedAtText = await Bun.$`date -u +%Y-%m-%dT%H:%M:%SZ`.text(),
 generatedAt = generatedAtText.trim(),
 inspectionPath = path.join(artifactsDirectory, "inspection.json"),
 inspectionReport: unknown = JSON.parse(await Bun.file(inspectionPath).text()),
 nodeVersion = process.version,
 evidence = {
  archiveChecksum: readArchiveChecksum(inspectionReport),
  archivePath,
  branch,
  bunVersion,
  commit,
  generatedAt,
  inspection: inspectionReport,
  nodeVersion,
  package: "nearly-headless-cms",
  version: packageManifest.version,
},
 evidenceJson = `${JSON.stringify(evidence, null, evidenceJsonIndent)}\n`;

await Bun.write(`${artifactsDirectory}/release-evidence.json`, evidenceJson);
await Bun.write(Bun.stdout, evidenceJson);
