import { $ } from "bun";
import { join } from "node:path";

const tag = process.argv[2],
  manifest: unknown = await Bun.file(
    join(import.meta.dir, "..", "packages/nearly-headless-cms/package.json"),
  ).json();
if (
  manifest === null ||
  typeof manifest !== "object" ||
  Array.isArray(manifest) ||
  typeof Reflect.get(manifest, "version") !== "string"
) {
  throw new Error("Package manifest must declare a string version");
}
const version = Reflect.get(manifest, "version");
if (tag !== `v${version}`) {
  throw new Error(`Tag ${String(tag)} does not match package version ${version}`);
}
await $`git merge-base --is-ancestor HEAD origin/main`.cwd(join(import.meta.dir, "..")).quiet();
const status = await $`git status --porcelain`.cwd(join(import.meta.dir, "..")).text();
if (status.trim().length > 0) {
  throw new Error("Release worktree must be clean");
}
console.log(`Release state is valid for ${tag}`);
