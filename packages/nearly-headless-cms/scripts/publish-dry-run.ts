import { join, resolve } from "node:path";

const repository = join(import.meta.dir, "..", "..", ".."),
  archivePath = resolve(
    Bun.env["PACKAGE_ARCHIVE"] ??
      join(repository, ".artifacts", "npm", "nearly-headless-cms-0.1.0.tgz"),
  );
if (!(await Bun.file(archivePath).exists())) {
  throw new Error(`Package archive does not exist: ${archivePath}`);
}
const dryRun = Bun.spawn(["npm", "publish", archivePath, "--dry-run", "--json"], {
  stderr: "inherit",
  stdout: "inherit",
});
if ((await dryRun.exited) !== 0) {
  throw new Error("npm publish dry-run failed");
}
