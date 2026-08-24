import { join } from "node:path";

const workspace = join(import.meta.dir, ".."),
  distributionDirectory = join(workspace, "dist"),
  runBuild = async (): Promise<void> => {
    const buildProcess = Bun.spawn(["bun", "run", "build"], {
      cwd: workspace,
      stderr: "inherit",
      stdout: "inherit",
    });
    if ((await buildProcess.exited) !== 0) {
      throw new Error("Package build failed during determinism verification");
    }
  },
  snapshot = async (): Promise<Readonly<Record<string, string>>> => {
    const entries: Array<readonly [string, string]> = [];
    for await (const relativePath of new Bun.Glob("**/*").scan({
      cwd: distributionDirectory,
      onlyFiles: true,
    })) {
      const hasher = new Bun.CryptoHasher("sha256");
      hasher.update(await Bun.file(join(distributionDirectory, relativePath)).arrayBuffer());
      entries.push([relativePath, hasher.digest("hex")]);
    }
    entries.sort(([left], [right]) => left.localeCompare(right));
    return Object.fromEntries(entries);
  };

await runBuild();
const firstBuild = await snapshot();
await runBuild();
const secondBuild = await snapshot();
if (JSON.stringify(firstBuild) !== JSON.stringify(secondBuild)) {
  throw new Error("Two clean package builds produced different bytes");
}
console.log(`Deterministic package build verified across ${Object.keys(firstBuild).length} files`);
