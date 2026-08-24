import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";

const workspace = join(import.meta.dir, ".."),
  readme = await Bun.file(join(workspace, "README.md")).text(),
  examples = [...readme.matchAll(/```ts\n([\s\S]*?)```/gu)].map((match) => match[1]!);
if (examples.length === 0) {
  throw new Error("Package README contains no TypeScript examples");
}
const exampleDirectory = await mkdtemp(join(workspace, ".readme-examples-"));
try {
  await Bun.write(
    join(exampleDirectory, "tsconfig.json"),
    `${JSON.stringify(
      {
        compilerOptions: {
          module: "NodeNext",
          moduleResolution: "NodeNext",
          noEmit: true,
          skipLibCheck: true,
          strict: true,
          target: "ES2023",
        },
        include: ["*.ts"],
      },
      null,
      2,
    )}\n`,
  );
  for (const [index, example] of examples.entries()) {
    await Bun.write(join(exampleDirectory, `example-${index + 1}.ts`), example);
  }
  for (const command of [
    ["bunx", "tsc", "-p", "tsconfig.json"],
    ...examples.map((_, index) => ["bun", `example-${index + 1}.ts`]),
  ]) {
    const verificationProcess = Bun.spawn(command, {
      cwd: exampleDirectory,
      stderr: "inherit",
      stdout: "inherit",
    });
    if ((await verificationProcess.exited) !== 0) {
      throw new Error(`README example verification failed: ${command.join(" ")}`);
    }
  }
} finally {
  await rm(exampleDirectory, { force: true, recursive: true });
}
console.log(`Compiled and executed ${examples.length} README examples`);
