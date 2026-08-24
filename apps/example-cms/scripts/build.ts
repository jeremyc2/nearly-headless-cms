import tailwind from "bun-plugin-tailwind";
import { join } from "node:path";

const workspace = join(import.meta.dir, ".."),
  result = await Bun.build({
    entrypoints: [join(workspace, "src", "index.html"), join(workspace, "src", "server.ts")],
    minify: true,
    outdir: join(workspace, "dist"),
    plugins: [tailwind],
    publicPath: "/",
    sourcemap: "linked",
    splitting: true,
    target: "bun",
  });

if (!result.success) {
  for (const log of result.logs) {
    console.error(log);
  }
  process.exitCode = 1;
}
