import {
  Effect,
  Exit,
  type Layer,
  atomicFilesystemLayer,
  expect,
  initialGeneration,
  join,
  mkdtemp,
  readEntryGeneration,
  spawnCommittingWriterChild,
  tmpdir,
} from "./filesystem-commit-boundary-child-scenarios-imports.ts";

const firstEntryIdentifier = "entry-1",
  runWithLayerExit = <Value, EffectError, Requirements>(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-179] Layer values are provided to runPromise without mutation.
    layer: Layer.Layer<Requirements, EffectError>,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-173] Effect programs are executed by runPromise without mutation.
    effect: Readonly<Effect.Effect<Value, EffectError, Requirements>>,
  ): Promise<Exit.Exit<Value, EffectError>> =>
    // oxlint-disable-next-line effecttsgo/strict-effect-provide -- [EH-112] test entry point needs a fresh isolated layer.
    Effect.runPromise(effect.pipe(Effect.provide(layer), Effect.exit)),
  verifyChildTerminationDuringEntryCommit = (): Promise<void> =>
    mkdtemp(join(tmpdir(), "nearly-headless-cms-child-entry-commit-")).then((root) => {
      const filesystemLayer = atomicFilesystemLayer(root);
      return spawnCommittingWriterChild(root)
        .then(() => runWithLayerExit(filesystemLayer, readEntryGeneration))
        .then((recoveryExit) => {
          expect(Exit.isSuccess(recoveryExit)).toBeTrue();
          if (!Exit.isSuccess(recoveryExit)) {
            return;
          }
          const recoveredGeneration = recoveryExit.value.generation;
          expect(
            recoveredGeneration === initialGeneration ||
              recoveredGeneration === initialGeneration + 1,
          ).toBeTrue();
          if (recoveredGeneration === initialGeneration + 1) {
            expect(
              recoveryExit.value.records.get(firstEntryIdentifier)?.entry.values["title"],
            ).toBe("Committed");
          } else {
            expect(recoveryExit.value.records.size).toBe(0);
          }
        });
    });

export { verifyChildTerminationDuringEntryCommit };
