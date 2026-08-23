import { resolve } from "node:path";

if (Bun.env["CONFIRM_NPM_RELEASE"] !== "nearly-headless-cms@0.1.0") {
  throw new Error("Refusing publication without the exact protected release confirmation");
}
const archiveValue = Bun.env["PACKAGE_ARCHIVE"];
if (archiveValue === undefined) {
  throw new Error("PACKAGE_ARCHIVE must identify the already inspected exact tarball");
}
const archivePath = resolve(archiveValue);
if (!(await Bun.file(archivePath).exists())) {
  throw new Error(`Package archive does not exist: ${archivePath}`);
}
const publication = Bun.spawn(["npm", "publish", archivePath, "--provenance"], {
  stderr: "inherit",
  stdout: "inherit",
});
if ((await publication.exited) !== 0) {
  throw new Error("npm publication failed");
}
