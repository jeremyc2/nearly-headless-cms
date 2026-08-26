import { Cause, Effect, Exit, type Layer, Option, Schema, Stream } from "effect";
import { Asset } from "../../src/index.ts";
import { InfrastructureFailure } from "../../src/cms-error.ts";
import { atomicFilesystemLayer } from "./filesystem-persistence-support.ts";
import { expect } from "bun:test";
// oxlint-disable-next-line effecttsgo/node-builtin-import -- [EH-211] Path joining is host-path setup for this filesystem integration test, outside the Effect service graph.
import { join } from "node:path";
// oxlint-disable-next-line effecttsgo/node-builtin-import -- [EH-212] The test exercises the Bun filesystem adapter's on-disk behavior; these helpers have no Bun equivalent.
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";

const ingestAssetEffect = Asset.Management.pipe(
    Effect.flatMap((assets) =>
      assets.ingest({
        content: new TextEncoder().encode("asset bytes"),
        filename: "pixel.txt",
        mediaType: "text/plain",
      }),
    ),
  ),
  readCorruptAssetEffect = (assetId: string) =>
    Asset.Management.pipe(
      Effect.flatMap((assets) => assets.read(assetId)),
      Effect.flatMap((asset) => Effect.exit(Stream.mkUint8Array(asset.content))),
    ),
  runWithLayer = <Value, EffectError, Requirements>(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-179] Layer values are provided to runPromise without mutation.
    layer: Layer.Layer<Requirements, EffectError>,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-173] Effect programs are executed by runPromise without mutation.
    effect: Readonly<Effect.Effect<Value, EffectError, Requirements>>,
  ): Promise<Value> => {
    // oxlint-disable-next-line effecttsgo/strict-effect-provide -- [EH-112] test entry point needs a fresh isolated layer.
    const providedEffect = effect.pipe(Effect.provide(layer));
    return Effect.runPromise(providedEffect);
  },
  verifyCorruptAssetClassification = (): Promise<void> =>
    mkdtemp(join(tmpdir(), "nearly-headless-cms-corrupt-asset-")).then((root) => {
      const filesystemLayer = atomicFilesystemLayer(root);
      return runWithLayer(filesystemLayer, ingestAssetEffect)
        .then((asset) =>
          Bun.write(
            join(root, "blobs", asset.metadata.digest),
            new TextEncoder().encode("bad content"),
          ).then(() => runWithLayer(filesystemLayer, readCorruptAssetEffect(asset.id))),
        )
        .then((readExit) => {
          expect(Exit.isFailure(readExit)).toBeTrue();
          if (!Exit.isFailure(readExit)) {
            throw new TypeError("Expected corrupt Asset stream failure");
          }
          const failure = Option.getOrUndefined(Cause.findErrorOption(readExit.cause));
          if (!Schema.is(InfrastructureFailure)(failure)) {
            throw new TypeError("Expected InfrastructureFailure");
          }
          expect(failure.kind).toBe("corruption");
        });
    });

export { verifyCorruptAssetClassification };
