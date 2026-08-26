import { Effect } from "effect";

const successfulExitCode = 0,
  twoSpaceIndent = 2,
  typescriptFencePattern = /```ts\n(?<source>[\s\S]*?)```/gu,
  workspace = new URL("..", import.meta.url).pathname,
  workspaceReadme = await Bun.file(`${workspace}/README.md`).text(),
  workspaceReadmeExamples = [...workspaceReadme.matchAll(typescriptFencePattern)].map((match) => {
    const source = match.groups?.["source"];
    if (source === undefined) {
      throw new Error("A README TypeScript fence did not contain source text");
    }
    return source;
  });

if (workspaceReadmeExamples.length === successfulExitCode) {
  throw new Error("Package README contains no TypeScript examples");
}

{
  const temporaryDirectoryOutput =
    await Bun.$`mktemp -d ${`${workspace}/.readme-examples-XXXXXX`}`.text();
  {
    const exampleDirectory = temporaryDirectoryOutput.trim(),
      exampleFileNumberOffset = 1;
    if (!exampleDirectory.startsWith(`${workspace}/.readme-examples-`)) {
      throw new Error(`Unexpected README example directory: ${exampleDirectory}`);
    }
    try {
      await Bun.write(
        `${exampleDirectory}/tsconfig.json`,
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
          twoSpaceIndent,
        )}\n`,
      );
      await Promise.all(
        workspaceReadmeExamples.map((example, index) =>
          Bun.write(`${exampleDirectory}/example-${index + exampleFileNumberOffset}.ts`, example),
        ),
      );
      {
        const typecheckProcess = Bun.spawn(["bunx", "tsc", "-p", "tsconfig.json"], {
          cwd: exampleDirectory,
          stderr: "inherit",
          stdout: "inherit",
        });
        if ((await typecheckProcess.exited) !== successfulExitCode) {
          throw new Error("README example TypeScript verification failed");
        }
      }
      {
        const executions = Array.from(workspaceReadmeExamples.keys(), (index) => {
            const command = ["bun", `example-${index + exampleFileNumberOffset}.ts`];
            return {
              command,
              exitCode: Bun.spawn(command, {
                cwd: exampleDirectory,
                stderr: "inherit",
                stdout: "inherit",
              }).exited,
            };
          }),
          results = await Promise.all(
            executions.map(({ command, exitCode }) =>
              exitCode.then((resolvedExitCode) => ({ command, resolvedExitCode })),
            ),
          );
        for (const { command, resolvedExitCode } of results) {
          if (resolvedExitCode !== successfulExitCode) {
            throw new Error(`README example verification failed: ${command.join(" ")}`);
          }
        }
      }
    } finally {
      await Bun.$`rm -rf ${exampleDirectory}`.quiet();
    }
  }
}

await Effect.runPromise(
  Effect.log(`Compiled and executed ${workspaceReadmeExamples.length} README examples`),
);
