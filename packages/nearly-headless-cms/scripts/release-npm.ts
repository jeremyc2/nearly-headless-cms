const archiveValue = Bun.env["PACKAGE_ARCHIVE"],
  successfulExitCode = 0;
if (Bun.env["CONFIRM_NPM_RELEASE"] !== "nearly-headless-cms@0.1.0") {
  throw new Error("Refusing publication without the exact protected release confirmation");
}
if (archiveValue === undefined) {
  throw new Error("PACKAGE_ARCHIVE must identify the already inspected exact tarball");
}
if (!(await Bun.file(archiveValue).exists())) {
  throw new Error(`Package archive does not exist: ${archiveValue}`);
}
if (
  (await Bun.spawn(["npm", "publish", archiveValue, "--provenance"], {
    stderr: "inherit",
    stdout: "inherit",
  }).exited) !== successfulExitCode
) {
  throw new Error("npm publication failed");
}
