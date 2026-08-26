import {
  Effect,
  Exit,
  type Layer,
  Persistence,
  atomicFilesystemLayer,
  chmod,
  durableFilesystemLayer,
  expect,
  join,
  mkdtemp,
  tmpdir,
} from "./filesystem-fault-injection-scenarios-imports.ts";

const firstEntryIdentifier = "entry-1",
  isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    value !== null && typeof value === "object" && !Array.isArray(value),
  readOnlyDirectoryMode = 0o500,
  readWriteDirectoryMode = 0o755,
  runWithLayer = <Value, EffectError, Requirements>(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-179] Layer values are provided to runPromise without mutation.
    layer: Layer.Layer<Requirements, EffectError>,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-173] Effect programs are executed by runPromise without mutation.
    effect: Readonly<Effect.Effect<Value, EffectError, Requirements>>,
  ): Promise<Value> =>
    // oxlint-disable-next-line effecttsgo/strict-effect-provide -- [EH-112] test entry point needs a fresh isolated layer.
    Effect.runPromise(effect.pipe(Effect.provide(layer))),
  runWithLayerExit = <Value, EffectError, Requirements>(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-179] Layer values are provided to runPromise without mutation.
    layer: Layer.Layer<Requirements, EffectError>,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-173] Effect programs are executed by runPromise without mutation.
    effect: Readonly<Effect.Effect<Value, EffectError, Requirements>>,
  ): Promise<Exit.Exit<Value, EffectError>> =>
    // oxlint-disable-next-line effecttsgo/strict-effect-provide -- [EH-112] test entry point needs a fresh isolated layer.
    Effect.runPromise(effect.pipe(Effect.provide(layer), Effect.exit)),
  verifyCommittedCorruptionPreservedOnRestart = (): Promise<void> =>
    mkdtemp(join(tmpdir(), "nearly-headless-cms-committed-corruption-")).then((root) => {
      const commitEntryEffect = Effect.gen(function* commitEntryEffect() {
          const entries = yield* Persistence.EntryPersistence,
            initialGeneration = yield* entries.readGeneration();
          yield* entries.commitGeneration(
            initialGeneration.generation,
            new Map([
              [
                firstEntryIdentifier,
                {
                  entry: {
                    contentTypeId: "note",
                    id: firstEntryIdentifier,
                    values: { title: "Committed" },
                  },
                  revisions: [],
                },
              ],
            ]),
          );
        }),
        filesystemLayer = atomicFilesystemLayer(root),
        readGenerationEffect = Effect.gen(function* readGenerationEffect() {
          const entries = yield* Persistence.EntryPersistence;
          yield* entries.readGeneration();
        });
      return runWithLayer(filesystemLayer, commitEntryEffect)
        .then(() => Bun.file(join(root, "manifest.json")).json())
        .then((manifest) => {
          if (!isRecord(manifest) || typeof manifest["generationDigest"] !== "string") {
            throw new TypeError("Expected manifest generationDigest");
          }
          return Bun.write(
            join(root, "manifest.json"),
            `${JSON.stringify({ ...manifest, generationDigest: "corrupt" })}\n`,
          );
        })
        .then(() => runWithLayerExit(filesystemLayer, readGenerationEffect))
        .then((restartExit) => {
          expect(Exit.isFailure(restartExit)).toBeTrue();
        });
    }),
  verifyGenerationCommitPermissionFailure = (): Promise<void> =>
    mkdtemp(join(tmpdir(), "nearly-headless-cms-generation-permission-")).then((root) => {
      const filesystemLayer = durableFilesystemLayer(root),
        generationsDirectory = join(root, "generations");
      return runWithLayer(
        filesystemLayer,
        Effect.gen(function* verifyGenerationCommitPermissionFailureEffect() {
          const entries = yield* Persistence.EntryPersistence,
            step1InitialGeneration = yield* entries.readGeneration();
          yield* Effect.promise(() => chmod(generationsDirectory, readOnlyDirectoryMode));
          // oxlint-disable-next-line eslint/one-var -- [EH-286] commit exit must follow the chmod yield before assertions.
          const step2FailedCommit = yield* Effect.exit(
            entries.commitGeneration(
              step1InitialGeneration.generation,
              new Map([
                [
                  firstEntryIdentifier,
                  {
                    entry: {
                      contentTypeId: "note",
                      id: firstEntryIdentifier,
                      values: { title: "Blocked" },
                    },
                    revisions: [],
                  },
                ],
              ]),
            ),
          );
          yield* Effect.promise(() => chmod(generationsDirectory, readWriteDirectoryMode));
          // oxlint-disable-next-line eslint/one-var -- [EH-287] read-back must follow the restore-chmod yield before assertions.
          const step3ReadBack = yield* entries.readGeneration();
          expect(Exit.isFailure(step2FailedCommit)).toBeTrue();
          expect(step3ReadBack.generation).toBe(step1InitialGeneration.generation);
          expect(step3ReadBack.records.size).toBe(step1InitialGeneration.records.size);
        }),
      );
    });

export { verifyCommittedCorruptionPreservedOnRestart, verifyGenerationCommitPermissionFailure };
