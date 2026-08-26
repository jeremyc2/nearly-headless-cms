import { $ } from "bun";

const workspace = `${import.meta.dir}/..`;
await $`bun run ${workspace}/scripts/clean.ts`.cwd(workspace);
await $`bunx tsc -p ${workspace}/tsconfig.build.json`.cwd(workspace);
