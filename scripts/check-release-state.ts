import { $ } from "bun";

const argumentIndex = 2,
  emptyLength = 0,
  manifestRepository = `${import.meta.dir}/..`,
  manifestValue: unknown = await Bun.file(
    `${manifestRepository}/packages/nearly-headless-cms/package.json`,
  ).json(),
  releaseTag = process.argv.at(argumentIndex);
if (
  manifestValue === null ||
  typeof manifestValue !== "object" ||
  Array.isArray(manifestValue) ||
  !("version" in manifestValue) ||
  typeof manifestValue.version !== "string"
) {
  throw new Error("Package manifest must declare a string version");
}
if (releaseTag !== `v${manifestValue.version}`) {
  throw new Error(
    `Tag ${String(releaseTag)} does not match package version ${manifestValue.version}`,
  );
}
await $`git merge-base --is-ancestor HEAD origin/main`.cwd(manifestRepository).quiet();
{
  const worktreeStatus = await $`git status --porcelain`.cwd(manifestRepository).text();
  if (worktreeStatus.trim().length > emptyLength) {
    throw new Error("Release worktree must be clean");
  }
}
await Bun.write(Bun.stdout, `Release state is valid for ${releaseTag}\n`);
