const repository = `${import.meta.dir}/../../..`,
  repositoryArchivePath =
    Bun.env["PACKAGE_ARCHIVE"] ?? `${repository}/.artifacts/npm/nearly-headless-cms-0.1.0.tgz`,
  successfulExitCode = 0;
if (!(await Bun.file(repositoryArchivePath).exists())) {
  throw new Error(`Package archive does not exist: ${repositoryArchivePath}`);
}
if (
  (await Bun.spawn(["npm", "publish", repositoryArchivePath, "--dry-run", "--json"], {
    stderr: "inherit",
    stdout: "inherit",
  }).exited) !== successfulExitCode
) {
  throw new Error("npm publish dry-run failed");
}
