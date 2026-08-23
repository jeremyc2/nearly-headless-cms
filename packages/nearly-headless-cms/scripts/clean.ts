import { rm } from "node:fs/promises";
import { join } from "node:path";

await rm(join(import.meta.dir, "..", "dist"), { force: true, recursive: true });
