import {
  Asset,
  Effect,
  Exit,
  type Layer,
} from "./filesystem-path-invariant-scenarios-imports.ts";
import { atomicFilesystemLayer, readEntryGeneration } from "./filesystem-persistence-support.ts";
import { expect } from "bun:test";
// oxlint-disable-next-line effecttsgo/node-builtin-import -- [EH-149] Path joining is host-path setup for this filesystem integration test, outside the Effect service graph.
import { join } from "node:path";
// oxlint-disable-next-line effecttsgo/node-builtin-import -- [EH-154] The test exercises the Bun filesystem adapter's on-disk behavior; these helpers have no Bun equivalent.
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";

const ingestAssetWithFilename = (filename: string) =>
    Asset.Management.pipe(
      Effect.flatMap((assets) =>
        assets.ingest({
          content: new TextEncoder().encode(filename),
          filename,
          mediaType: "text/plain",
        }),
      ),
    ),
  lighthouseUnicodeFilename = "灯台.svg",
  runWithLayer = <Value, EffectError, Requirements>(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-244] Layer values are provided to runPromise without mutation.
    layer: Layer.Layer<Requirements, EffectError>,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-237] Effect programs are executed by runPromise without mutation.
    effect: Readonly<Effect.Effect<Value, EffectError, Requirements>>,
  ): Promise<Value> => {
    // oxlint-disable-next-line effecttsgo/strict-effect-provide -- [EH-162] test entry point needs a fresh isolated layer.
    const providedEffect = effect.pipe(Effect.provide(layer));
    return Effect.runPromise(providedEffect);
  },
  runWithLayerExit = <Value, EffectError, Requirements>(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-244] Layer values are provided to runPromise without mutation.
    layer: Layer.Layer<Requirements, EffectError>,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-237] Effect programs are executed by runPromise without mutation.
    effect: Readonly<Effect.Effect<Value, EffectError, Requirements>>,
  ): Promise<Exit.Exit<Value, EffectError>> => {
    // oxlint-disable-next-line effecttsgo/strict-effect-provide -- [EH-162] test entry point needs a fresh isolated layer.
    const providedEffect = effect.pipe(Effect.provide(layer), Effect.exit);
    return Effect.runPromise(providedEffect);
  },
  verifyAbandonedStagingPrefixCleanedOnRecovery = (): Promise<void> =>
    mkdtemp(join(tmpdir(), "nearly-headless-cms-staging-prefix-")).then((root) => {
      const abandonedStagePath = join(root, ".nhcms-stage-abandoned-root"),
        filesystemLayer = atomicFilesystemLayer(root);
      return runWithLayer(filesystemLayer, readEntryGeneration)
        .then(() => Bun.write(abandonedStagePath, "abandoned"))
        .then(() => runWithLayer(filesystemLayer, readEntryGeneration))
        .then(() => Bun.file(abandonedStagePath).exists())
        .then((stageRemoved) => {
          expect(stageRemoved).toBeFalse();
        });
    }),
  verifyCaseDistinctAssetFilenamesPreservedInMetadata = (): Promise<void> =>
    mkdtemp(join(tmpdir(), "nearly-headless-cms-case-filename-")).then((root) => {
      const filesystemLayer = atomicFilesystemLayer(root);
      return runWithLayer(
        filesystemLayer,
        Effect.all([ingestAssetWithFilename("Beacon.txt"), ingestAssetWithFilename("beacon.txt")]),
      ).then(([uppercaseAsset, lowercaseAsset]) => {
        expect(uppercaseAsset.metadata.filename).toBe("Beacon.txt");
        expect(lowercaseAsset.metadata.filename).toBe("beacon.txt");
        expect(uppercaseAsset.metadata.digest).not.toBe(lowercaseAsset.metadata.digest);
      });
    }),
  verifyUnexpectedRootEntryRejectedOnStartup = (): Promise<void> =>
    mkdtemp(join(tmpdir(), "nearly-headless-cms-unexpected-root-")).then((root) => {
      const filesystemLayer = atomicFilesystemLayer(root);
      return runWithLayer(filesystemLayer, readEntryGeneration)
        .then(() => Bun.write(join(root, "surprise.txt"), "unexpected"))
        .then(() => runWithLayerExit(filesystemLayer, readEntryGeneration))
        .then((reloadExit) => {
          expect(Exit.isFailure(reloadExit)).toBeTrue();
        });
    }),
  verifyUnicodeAssetFilenameRoundTrip = (): Promise<void> =>
    mkdtemp(join(tmpdir(), "nearly-headless-cms-unicode-filename-")).then((root) => {
      const filesystemLayer = atomicFilesystemLayer(root),
        ingestProgram = Asset.Management.pipe(
          Effect.flatMap((assets) =>
            assets.ingest({
              content: new TextEncoder().encode("<svg></svg>"),
              filename: lighthouseUnicodeFilename,
              mediaType: "image/svg+xml",
            }),
          ),
        );
      return runWithLayer(filesystemLayer, ingestProgram).then((asset) => {
        expect(asset.metadata.filename).toBe(lighthouseUnicodeFilename);
        return runWithLayer(
          filesystemLayer,
          Asset.Management.pipe(
            Effect.flatMap((assets) => assets.get(asset.id)),
            Effect.map((storedAsset) => storedAsset.metadata.filename),
          ),
        ).then((filename) => {
          expect(filename).toBe(lighthouseUnicodeFilename);
        });
      });
    });

export {
  verifyAbandonedStagingPrefixCleanedOnRecovery,
  verifyCaseDistinctAssetFilenamesPreservedInMetadata,
  verifyUnexpectedRootEntryRejectedOnStartup,
  verifyUnicodeAssetFilenameRoundTrip,
};
