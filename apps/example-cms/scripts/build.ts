import tailwind from "bun-plugin-tailwind";

const workspace = `${import.meta.dir}/..`,
  workspaceBuildResult = await Bun.build({
    entrypoints: [`${workspace}/src/index.html`, `${workspace}/src/server.ts`],
    minify: true,
    outdir: `${workspace}/dist`,
    plugins: [tailwind],
    publicPath: "/",
    sourcemap: "linked",
    splitting: true,
    target: "bun",
  });

if (!workspaceBuildResult.success) {
  await Bun.write(
    Bun.stderr,
    `${workspaceBuildResult.logs.map((log) => log.message).join("\n")}\n`,
  );
  process.exitCode = 1;
}
