import {
  type Configuration,
  Effect,
  type InfrastructureFailure,
  NotFound,
  type State,
  Stream,
  SynchronizedRef,
  join,
} from "./bun-filesystem-persistence-services-imports.ts";
import assetStream from "../../asset-stream.ts";
import filesystemSupport from "./bun-filesystem-persistence-support.ts";

const { oneShot } = assetStream,
  { failure } = filesystemSupport,
  assetContent = (
    path: string,
    expectedByteLength: number,
    expectedDigest: string,
  ): Stream.Stream<Uint8Array, InfrastructureFailure> =>
    Stream.unwrap(
      Effect.sync(() => {
        const assetVerification = {
            byteLength: 0,
            hasher: new Bun.CryptoHasher("sha256"),
          },
          content = Stream.fromReadableStream({
            evaluate: () => Bun.file(path).stream(),
            onError: (cause) => failure("Filesystem Asset Blob read failed", cause),
          }).pipe(
            Stream.tap((bytes) =>
              Effect.sync(() => {
                assetVerification.byteLength += bytes.byteLength;
                assetVerification.hasher.update(bytes);
              }),
            ),
          ),
          verify = Effect.suspend(() => {
            const actualDigest = assetVerification.hasher.digest("hex");
            if (
              assetVerification.byteLength !== expectedByteLength ||
              actualDigest !== expectedDigest
            ) {
              return Effect.fail(
                failure("Filesystem Asset Blob is corrupt", new Error("digest mismatch")),
              );
            }
            return Effect.void;
          });
        return content.pipe(Stream.concat(Stream.fromEffect(verify).pipe(Stream.drain)));
      }),
    ),
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
      return {
        content: oneShot(
          assetContent(
            join(configuration.root, "blobs", asset.metadata.digest),
            asset.metadata.byteLength,
            asset.metadata.digest,
          ),
          () =>
            failure(
              "Asset content stream has already been consumed",
              new Error("stream already consumed"),
            ),
        ),
        id: asset.id,
        metadata: asset.metadata,
      };
    });

export default { readAsset };
