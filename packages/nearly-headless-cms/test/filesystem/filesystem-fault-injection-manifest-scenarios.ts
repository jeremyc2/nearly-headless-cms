import {
  Effect,
  Exit,
  type Layer,
  Persistence,
  atomicFilesystemLayer,
  expect,
  join,
  mkdir,
  mkdtemp,
  rm,
  tmpdir,
} from "./filesystem-fault-injection-manifest-scenarios-imports.ts";

const firstEntryIdentifier = "entry-1",
  commitNoteTitleEffect = (title: string) =>
    Effect.gen(function* commitNoteTitleAtCurrentGeneration() {
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
                values: { title },
              },
              revisions: [],
            },
          ],
        ]),
      );
    }),
  obstructManifestPublicationEffect = (manifestPath: string) =>
    Effect.promise(() =>
      rm(manifestPath, { force: true }).then(() => mkdir(manifestPath)),
    ),
  runWithLayer = <Value, EffectError, Requirements>(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-244] Layer values are provided to runPromise without mutation.
    layer: Layer.Layer<Requirements, EffectError>,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-237] Effect programs are executed by runPromise without mutation.
    effect: Readonly<Effect.Effect<Value, EffectError, Requirements>>,
  ): Promise<Value> =>
    // oxlint-disable-next-line effecttsgo/strict-effect-provide -- [EH-162] test entry point needs a fresh isolated layer.
    Effect.runPromise(effect.pipe(Effect.provide(layer))),
  verifyManifestPublicationPermissionFailure = (): Promise<void> =>
    mkdtemp(join(tmpdir(), "nearly-headless-cms-manifest-permission-")).then((root) => {
      const filesystemLayer = atomicFilesystemLayer(root),
        manifestPath = join(root, "manifest.json");
      return runWithLayer(
        filesystemLayer,
        Effect.gen(function* verifyManifestPublicationPermissionFailureEffect() {
          yield* commitNoteTitleEffect("First");
          yield* commitNoteTitleEffect("Second");
          const entries = yield* Persistence.EntryPersistence,
            step3CommittedGeneration = yield* entries.readGeneration();
          yield* obstructManifestPublicationEffect(manifestPath);
          // oxlint-disable-next-line eslint/one-var -- [EH-183] commit exit must follow the manifest obstruction yield before assertions.
          const step4FailedCommit = yield* Effect.exit(
            entries.commitGeneration(
              step3CommittedGeneration.generation,
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
          yield* Effect.promise(() => rm(manifestPath, { force: true, recursive: true }));
          // oxlint-disable-next-line eslint/one-var -- [EH-189] read-back must follow manifest obstruction cleanup before assertions.
          const step5ReadBack = yield* entries.readGeneration();
          expect(Exit.isFailure(step4FailedCommit)).toBeTrue();
          expect(step5ReadBack.generation).toBe(step3CommittedGeneration.generation);
          expect(step5ReadBack.records.get(firstEntryIdentifier)?.entry.values["title"]).toBe(
            "Second",
          );
        }),
      );
    });

export { verifyManifestPublicationPermissionFailure };
