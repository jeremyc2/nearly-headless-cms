import {
  type Configuration,
  Effect,
  NotFound,
  type State,
  SynchronizedRef,
  join,
} from "./bun-filesystem-persistence-services-imports.ts";
import filesystemSupport from "./bun-filesystem-persistence-support.ts";

const { digest, failure, fromPromise } = filesystemSupport,
  readAsset = <Ref extends SynchronizedRef.SynchronizedRef<State>>(
    configuration: Readonly<Configuration>,
    state: Readonly<Ref>,
    assetId: string,
  ) =>
    Effect.gen(function* readAssetBlob() {
      const asset = (yield* SynchronizedRef.get(state)).assets.get(assetId);
      if (asset === undefined) {
        return yield* NotFound.make({ message: `Asset ${assetId} was not found` });
      }
      return yield* fromPromise(
        () =>
          Bun.file(join(configuration.root, "blobs", asset.metadata.digest))
            .arrayBuffer()
            .then((buffer) => new Uint8Array(buffer)),
        "Filesystem Asset Blob read failed",
      ).pipe(
        Effect.flatMap((bytes) => {
          if (
            bytes.byteLength !== asset.metadata.byteLength ||
            digest(bytes) !== asset.metadata.digest
          ) {
            return failure("Filesystem Asset Blob is corrupt", new Error("digest mismatch"));
          }
          return Effect.succeed({ bytes, id: asset.id, metadata: asset.metadata });
        }),
      );
    });

export default { readAsset };
