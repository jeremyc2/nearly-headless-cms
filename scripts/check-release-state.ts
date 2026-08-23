import { $ } from "bun";
import { join } from "node:path";

const tag = process.argv[2],
  manifest = (await Bun.file(
    join(import.meta.dir, "..", "packages/nearly-headless-cms/package.json"),
  ).json()) as { readonly version: string };
if (tag !== `v${manifest.version}`) {
  throw new Error(`Tag ${String(tag)} does not match package version ${manifest.version}`);
}
await $`git merge-base --is-ancestor HEAD origin/main`.cwd(join(import.meta.dir, "..")).quiet();
const status = await $`git status --porcelain`.cwd(join(import.meta.dir, "..")).text();
if (status.trim().length > 0) {
  throw new Error("Release worktree must be clean");
}
console.log(`Release state is valid for ${tag}`);
