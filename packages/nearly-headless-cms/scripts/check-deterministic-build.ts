import { Effect, Schema } from "effect";

const makeTaggedErrorClass = Schema.TaggedError,
  workspaceSnapshotsMatch = (
    firstSnapshot: Readonly<Record<string, string>>,
    secondSnapshot: Readonly<Record<string, string>>,
  ): boolean => {
    const firstEntries = Object.entries(firstSnapshot),
      secondEntries = Object.entries(secondSnapshot);
    if (firstEntries.length !== secondEntries.length) {
      return false;
    }
    return firstEntries.every(([relativePath, digest]) => secondSnapshot[relativePath] === digest);
  };

class BuildVerificationFailure extends makeTaggedErrorClass<BuildVerificationFailure>()(
  "BuildVerificationFailure",
  {
    cause: Schema.optional(Schema.Unknown),
    message: Schema.String,
  },
) {}

{
  const distributionDirectory = new URL("../dist/", import.meta.url).pathname,
    successfulExitCode = 0,
    workspace = new URL("..", import.meta.url).pathname,
    workspaceRunBuild = (): Effect.Effect<void, BuildVerificationFailure> =>
      Effect.try({
        catch: (cause) =>
          BuildVerificationFailure.make({ cause, message: "Package build could not start" }),
        try: () =>
          Bun.spawn(["bun", "run", "build"], {
            cwd: workspace,
            stderr: "inherit",
            stdout: "inherit",
          }),
      }).pipe(
        Effect.flatMap((buildProcess) =>
          Effect.tryPromise({
            catch: (cause) =>
              BuildVerificationFailure.make({ cause, message: "Package build did not finish" }),
            try: () => buildProcess.exited,
          }),
        ),
        Effect.flatMap((exitCode) => {
          if (exitCode === successfulExitCode) {
            return Effect.void;
          }
          return Effect.fail(
            BuildVerificationFailure.make({
              message: "Package build failed during determinism verification",
            }),
          );
        }),
      ),
    workspaceSnapshot = (): Effect.Effect<
      Readonly<Record<string, string>>,
      BuildVerificationFailure
    > =>
      Effect.tryPromise({
        catch: (cause) =>
          BuildVerificationFailure.make({ cause, message: "Built files could not be enumerated" }),
        try: () =>
          Array.fromAsync(
            new Bun.Glob("**/*").scan({ cwd: distributionDirectory, onlyFiles: true }),
          ),
      }).pipe(
        Effect.flatMap((relativePaths) =>
          Effect.all(
            relativePaths.map((relativePath) =>
              Effect.tryPromise({
                catch: (cause) =>
                  BuildVerificationFailure.make({
                    cause,
                    message: `Could not read built file ${relativePath}`,
                  }),
                try: () => Bun.file(`${distributionDirectory}${relativePath}`).arrayBuffer(),
              }).pipe(
                Effect.map((contents): readonly [string, string] => {
                  const hasher = new Bun.CryptoHasher("sha256");
                  hasher.update(contents);
                  return [relativePath, hasher.digest("hex")];
                }),
              ),
            ),
          ),
        ),
        Effect.map((entries) => {
          entries.sort(([leftPath], [rightPath]) => leftPath.localeCompare(rightPath));
          return Object.fromEntries(entries);
        }),
      ),
    zProgram = Effect.gen(function* checkDeterministicBuild() {
      yield* workspaceRunBuild();
      const firstBuild = yield* workspaceSnapshot();
      yield* workspaceRunBuild();
      {
        const secondBuild = yield* workspaceSnapshot();
        if (!workspaceSnapshotsMatch(firstBuild, secondBuild)) {
          return yield* BuildVerificationFailure.make({
            message: "Two clean package builds produced different bytes",
          });
        }
      }
      return yield* Effect.log(
        `Deterministic package build verified across ${Object.keys(firstBuild).length} files`,
      );
    });

  await Effect.runPromise(zProgram);
}
