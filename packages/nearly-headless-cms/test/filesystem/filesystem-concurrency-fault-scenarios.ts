import {
  Asset,
  Effect,
  Exit,
  type Layer,
  Stream,
  atomicFilesystemLayer,
  chmod,
  expect,
  join,
  mkdtemp,
  symlink,
  tmpdir,
  unlink,
} from "./filesystem-concurrency-fault-scenarios-imports.ts";

const concurrentReadCount = 4,
  ingestAssetEffect = Asset.Management.pipe(
    Effect.flatMap((assets) =>
      assets.ingest({
        content: new TextEncoder().encode("asset bytes"),
        filename: "pixel.txt",
        mediaType: "text/plain",
      }),
    ),
  ),
  readAssetBytesEffect = (assetId: string) =>
    Asset.Management.pipe(
      Effect.flatMap((assets) => assets.read(assetId)),
      Effect.flatMap((asset) => Stream.mkUint8Array(asset.content)),
    ),
  readOnlyBlobDirectoryMode = 0o500,
  readWriteBlobDirectoryMode = 0o755,
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
  verifyConcurrentAssetReads = (): Promise<void> =>
    mkdtemp(join(tmpdir(), "nearly-headless-cms-concurrent-reads-")).then((root) => {
      const filesystemLayer = atomicFilesystemLayer(root);
      return runWithLayer(
        filesystemLayer,
        Effect.gen(function* verifyConcurrentAssetReadsEffect() {
          const asset = yield* ingestAssetEffect,
           readResults = yield* Effect.all(
            Array.from({ length: concurrentReadCount }, () => readAssetBytesEffect(asset.id)),
            { concurrency: concurrentReadCount },
          );
          for (const bytes of readResults) {
            expect(new TextDecoder().decode(bytes)).toBe("asset bytes");
          }
        }),
      );
    }),
  verifyReadOnlyBlobDirectorySurfacesPermissionFailure = (): Promise<void> =>
    mkdtemp(join(tmpdir(), "nearly-headless-cms-readonly-blobs-")).then((root) => {
      const blobsDirectory = join(root, "blobs"),
        filesystemLayer = atomicFilesystemLayer(root);
      return Bun.$`mkdir -p ${blobsDirectory}`.quiet().then(() =>
        chmod(blobsDirectory, readOnlyBlobDirectoryMode).then(() => {
          const ingestProgram = Asset.Management.pipe(
            Effect.flatMap((assets) =>
              assets.ingest({
                content: new TextEncoder().encode("blocked"),
                filename: "blocked.txt",
                mediaType: "text/plain",
              }),
            ),
          );
          return runWithLayer(filesystemLayer, Effect.exit(ingestProgram));
        }),
      ).then((ingestExit) => {
        expect(Exit.isFailure(ingestExit)).toBeTrue();
        return chmod(blobsDirectory, readWriteBlobDirectoryMode);
      });
    }),
  verifySymlinkedBlobIsNotServedAsContent = (): Promise<void> =>
    mkdtemp(join(tmpdir(), "nearly-headless-cms-symlink-blob-")).then((root) => {
      const filesystemLayer = atomicFilesystemLayer(root);
      return runWithLayer(filesystemLayer, ingestAssetEffect).then((asset) => {
        const blobPath = join(root, "blobs", asset.metadata.digest),
          outsidePath = join(tmpdir(), `nearly-headless-cms-outside-${asset.id}.txt`);
        return Bun.write(outsidePath, "outside bytes")
          .then(() => unlink(blobPath))
          .then(() => symlink(outsidePath, blobPath))
          .then(() => runWithLayer(filesystemLayer, Effect.exit(readAssetBytesEffect(asset.id))))
          .then((readExit) => {
            expect(Exit.isFailure(readExit)).toBeTrue();
          });
      });
    });

export {
  verifyConcurrentAssetReads,
  verifyReadOnlyBlobDirectorySurfacesPermissionFailure,
  verifySymlinkedBlobIsNotServedAsContent,
};
