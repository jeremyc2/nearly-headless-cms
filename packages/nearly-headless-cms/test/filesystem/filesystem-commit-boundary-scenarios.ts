import {
  Effect,
  Exit,
  type Layer,
  Persistence,
  atomicFilesystemLayer,
  expect,
  join,
  mkdtemp,
  tmpdir,
} from "./filesystem-commit-boundary-scenarios-imports.ts";

const firstEntryIdentifier = "entry-1",
  runWithLayer = <Value, EffectError, Requirements>(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-179] Layer values are provided to runPromise without mutation.
    layer: Layer.Layer<Requirements, EffectError>,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-173] Effect programs are executed by runPromise without mutation.
    effect: Readonly<Effect.Effect<Value, EffectError, Requirements>>,
  ): Promise<Value> =>
    // oxlint-disable-next-line effecttsgo/strict-effect-provide -- [EH-112] test entry point needs a fresh isolated layer.
    Effect.runPromise(effect.pipe(Effect.provide(layer))),
  verifyOldOrNewEntryVisibility = (): Promise<void> =>
    mkdtemp(join(tmpdir(), "nearly-headless-cms-entry-visibility-")).then((root) => {
      const filesystemLayer = atomicFilesystemLayer(root);
      return runWithLayer(
        filesystemLayer,
        Effect.gen(function* verifyOldOrNewEntryVisibilityEffect() {
          const entries = yield* Persistence.EntryPersistence,
           step1InitialGeneration = yield* entries.readGeneration(),
           step2Committed = yield* entries.commitGeneration(
            step1InitialGeneration.generation,
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
          ),
           step3ReadBack = yield* entries.readGeneration();
          expect(step2Committed.generation).toBe(step1InitialGeneration.generation + 1);
          expect(step3ReadBack.generation).toBe(step2Committed.generation);
          expect(step3ReadBack.records.get(firstEntryIdentifier)?.entry.values["title"]).toBe(
            "Committed",
          );
          expect(step1InitialGeneration.records.size).toBe(0);
        }),
      );
    }),
  verifySerializedEntryMutations = (): Promise<void> =>
    mkdtemp(join(tmpdir(), "nearly-headless-cms-serialized-entry-writes-")).then((root) => {
      const filesystemLayer = atomicFilesystemLayer(root);
      return runWithLayer(
        filesystemLayer,
        Effect.gen(function* verifySerializedEntryMutationsEffect() {
          const entries = yield* Persistence.EntryPersistence,
           step1InitialGeneration = yield* entries.readGeneration(),
           step2FirstRecords = new Map([
            [
              firstEntryIdentifier,
              {
                entry: {
                  contentTypeId: "note",
                  id: firstEntryIdentifier,
                  values: { title: "First" },
                },
                revisions: [],
              },
            ],
          ]),
           step3Committed = yield* entries.commitGeneration(
            step1InitialGeneration.generation,
            step2FirstRecords,
          ),
           step4StaleCommit = yield* Effect.exit(
            entries.commitGeneration(step1InitialGeneration.generation, step2FirstRecords),
          ),
           step5ReadBack = yield* entries.readGeneration();
          expect(step3Committed.generation).toBe(step1InitialGeneration.generation + 1);
          expect(Exit.isFailure(step4StaleCommit)).toBeTrue();
          expect(step5ReadBack.records.get(firstEntryIdentifier)?.entry.values["title"]).toBe(
            "First",
          );
        }),
      );
    }),
  verifyStaleEntryGenerationConflict = (): Promise<void> =>
    mkdtemp(join(tmpdir(), "nearly-headless-cms-stale-entry-generation-")).then((root) => {
      const filesystemLayer = atomicFilesystemLayer(root);
      return runWithLayer(
        filesystemLayer,
        Effect.gen(function* verifyStaleEntryGenerationConflictEffect() {
          const entries = yield* Persistence.EntryPersistence,
           step1InitialGeneration = yield* entries.readGeneration(),
           step2StaleCommit = yield* Effect.exit(
            entries.commitGeneration(
              step1InitialGeneration.generation + 1,
              step1InitialGeneration.records,
            ),
          );
          expect(Exit.isFailure(step2StaleCommit)).toBeTrue();
        }),
      );
    });

export {
  verifyOldOrNewEntryVisibility,
  verifySerializedEntryMutations,
  verifyStaleEntryGenerationConflict,
};
