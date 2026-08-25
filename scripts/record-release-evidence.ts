// oxlint-disable-next-line effecttsgo/node-builtin-import -- [EH-102] Standalone CLI resolves repository paths before any Effect application exists.
import path from "node:path";
import { readPackageManifest } from "./package-manifest.ts";

const artifactsDirectory = path.join(import.meta.dir, "..", ".artifacts/npm"),
 monorepoRoot = path.join(import.meta.dir, ".."),
 packageManifest = await readPackageManifest(
  path.join(monorepoRoot, "packages/nearly-headless-cms/package.json"),
 ),
 // oxlint-disable-next-line eslint/sort-vars -- [EH-133] archive path depends on the resolved package manifest version.
 archivePath = path.join(artifactsDirectory, `nearly-headless-cms-${packageManifest.version}.tgz`),
 branchText = await Bun.$`git rev-parse --abbrev-ref HEAD`.cwd(monorepoRoot).text(),
// oxlint-disable-next-line eslint/sort-vars -- [EH-133] branch text is trimmed immediately into the release evidence artifact field.
 branch = branchText.trim(),
 bunVersion = Bun.version,
 commitText = await Bun.$`git rev-parse HEAD`.cwd(monorepoRoot).text(),
// oxlint-disable-next-line eslint/sort-vars -- [EH-133] commit text is trimmed immediately into the release evidence artifact field.
 commit = commitText.trim(),
 evidenceJsonIndent = 2,
 generatedAtText = await Bun.$`date -u +%Y-%m-%dT%H:%M:%SZ`.text(),
// oxlint-disable-next-line eslint/sort-vars -- [EH-133] generated-at text is trimmed immediately into the release evidence artifact field.
 generatedAt = generatedAtText.trim(),
 inspectionPath = path.join(artifactsDirectory, "inspection.json"),
// oxlint-disable-next-line eslint/sort-vars -- [EH-133] inspection report parsing follows the resolved archive and git metadata fields.
 inspectionReport: unknown = JSON.parse(await Bun.file(inspectionPath).text()),
 nodeVersion = process.version,
 // oxlint-disable-next-line eslint/sort-vars -- [EH-133] evidence object aggregates the resolved release metadata fields.
 evidence = {
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
