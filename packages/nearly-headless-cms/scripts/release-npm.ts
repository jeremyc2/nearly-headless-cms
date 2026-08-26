import { readPackageManifest } from "./package-manifest.ts";

const archiveValue = Bun.env["PACKAGE_ARCHIVE"],
  packageDirectory = `${import.meta.dir}/..`,
  packageManifest = await readPackageManifest(`${packageDirectory}/package.json`),
  releaseConfirmation = `nearly-headless-cms@${packageManifest.version}`,
  publishArchive = (archivePath: string): Promise<number> => {
    let provenanceFlag = "--provenance=false";
    if (Bun.env["GITHUB_ACTIONS"] === "true") {
      provenanceFlag = "--provenance";
    }
    return Bun.spawn(["npm", "publish", archivePath, provenanceFlag], {
      stderr: "inherit",
      stdout: "inherit",
    }).exited;
  },
  successfulExitCode = 0;

if (Bun.env["CONFIRM_NPM_RELEASE"] !== releaseConfirmation) {
  throw new Error(
    `Refusing publication without the exact protected release confirmation: ${releaseConfirmation}`,
  );
}
if (archiveValue === undefined) {
  throw new Error("PACKAGE_ARCHIVE must identify the already inspected exact tarball");
}
if (!(await Bun.file(archiveValue).exists())) {
  throw new Error(`Package archive does not exist: ${archiveValue}`);
}
if ((await publishArchive(archiveValue)) !== successfulExitCode) {
  throw new Error("npm publication failed");
}
