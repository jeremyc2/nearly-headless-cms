import { $ } from "bun";
import { join } from "node:path";

const workspace = join(import.meta.dir, "..");
await $`bun run ${join(workspace, "scripts", "clean.ts")}`.cwd(workspace);
await $`bunx tsc -p ${join(workspace, "tsconfig.build.json")}`.cwd(workspace);
