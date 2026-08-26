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

if (Bun.env["GITHUB_ACTIONS"] !== "true" && Bun.env["NODE_AUTH_TOKEN"] === undefined) {
  // oxlint-disable-next-line effecttsgo/global-console -- [EH-361] npm bootstrap publish guidance is intentionally emitted before interactive registry authentication.
  console.log(
    [
      "",
      "Publishing to npm from your machine.",
      "Accounts with 2FA enabled use npm's browser device flow (EOTP): npm prints a URL,",
      "you open it in a browser and sign in, and this command continues when auth completes.",
      "For a non-interactive bootstrap publish, export NODE_AUTH_TOKEN with a narrowly scoped Automation token.",
      "",
    ].join("\n"),
  );
}

if ((await publishArchive(archiveValue)) !== successfulExitCode) {
  throw new Error(
    [
      "npm publication failed.",
      "If npm printed EOTP, open the https://www.npmjs.com/auth/cli/ URL in your browser, complete sign-in, and rerun:",
      "  bun run release --publish-only",
      "To skip browser auth, export NODE_AUTH_TOKEN with an Automation token before publishing.",
    ].join("\n"),
  );
}
