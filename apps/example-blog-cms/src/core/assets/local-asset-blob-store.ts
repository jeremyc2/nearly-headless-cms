import type { Asset } from "nearly-headless-cms";
import { CmsError } from "nearly-headless-cms";
import { Effect, Schema, Stream } from "effect";
// oxlint-disable-next-line effecttsgo/node-builtin-import -- [EH-332] This Bun adapter needs durable rename/remove primitives unavailable in Effect's portable FileSystem layer.
import { mkdir, rename, rm } from "node:fs/promises";
// oxlint-disable-next-line effecttsgo/node-builtin-import -- [EH-145] Bun does not provide a path manipulation API; these operations are platform-neutral string handling.
import { join } from "node:path";
import {
  defaultAssetMaximumByteLength,
  defaultMetadataMaximumByteLength,
  stagingPrefix,
} from "../persistence/sql-persistence-constants.ts";

const joinPath = (...segments: readonly string[]): string => join(...segments),
  contentStreamFromInput = (
    content: Asset.IngestInput["content"],
  ): Stream.Stream<Uint8Array, CmsError.InfrastructureFailure> => {
    if (content instanceof Uint8Array) {
      return Stream.make(content);
    }
    return content;
  };

export interface LocalAssetBlobStoreConfiguration {
  readonly root: string;
  readonly maximumAssetByteLength?: number;
  readonly maximumMetadataByteLength?: number;
}

/**
 * Local filesystem blob store standing in for S3 object storage.
 * In production, swap this module for `s3-asset-blob-store-reference.ts`.
 */
export const localAssetBlobStore = (configuration: LocalAssetBlobStoreConfiguration) => {
  const blobsDirectory = joinPath(configuration.root, "asset-blobs"),
    ensureBlobDirectory = (): Effect.Effect<void, CmsError.InfrastructureFailure> =>
      Effect.tryPromise({
        catch: (cause) =>
          CmsError.InfrastructureFailure.make({
            cause,
            message: "Local asset blob directory creation failed",
            retryable: true,
          }),
        try: () => mkdir(blobsDirectory, { recursive: true }).then(() => {}),
      }),
    validateIngestInput = (input: Asset.IngestInput): Effect.Effect<void, CmsError.InvalidInput> => {
      if (input.filename.trim().length === 0 || !input.mediaType.includes("/")) {
        return CmsError.InvalidInput.make({ message: "Asset filename and media type are required" });
      }
      const metadataByteLength = new TextEncoder().encode(
        JSON.stringify({
          defaultAlternativeText: input.defaultAlternativeText,
          filename: input.filename,
          height: input.height,
          mediaType: input.mediaType,
          width: input.width,
        }),
      ).byteLength;
      if (
        metadataByteLength >
        (configuration.maximumMetadataByteLength ?? defaultMetadataMaximumByteLength)
      ) {
        return CmsError.InvalidInput.make({ message: "Asset metadata exceeds the configured limit" });
      }
      return Effect.void;
    },
    commitBlob = (
      content: Asset.IngestInput["content"],
    ): Effect.Effect<
      { readonly byteLength: number; readonly digest: string },
      CmsError.InfrastructureFailure | CmsError.InvalidInput
    > =>
      Effect.gen(function* commitLocalAssetBlob() {
        yield* ensureBlobDirectory();
        const maximumByteLength =
            configuration.maximumAssetByteLength ?? defaultAssetMaximumByteLength,
          contentStream = contentStreamFromInput(content),
          stagePath = joinPath(
            blobsDirectory,
            // oxlint-disable-next-line effecttsgo/crypto-random-uuid, effecttsgo/crypto-random-uuid-in-effect -- [EH-090, EH-347] staging paths are built synchronously in Bun's filesystem bridge.
            `${stagingPrefix}blob-${crypto.randomUUID()}`,
          ),
          hasher = new Bun.CryptoHasher("sha256"),
          writer = Bun.file(stagePath).writer({ highWaterMark: 65_536 });
        let byteLength = 0;
        const commitResult = yield* Stream.runForEach(contentStream, (chunk) =>
          Effect.try({
            catch: (cause) => {
              if (Schema.is(CmsError.InvalidInput)(cause)) {
                return cause;
              }
              return CmsError.InfrastructureFailure.make({
                cause,
                message: "Local asset blob staging write failed",
                retryable: true,
              });
            },
            try: () => {
              byteLength += chunk.byteLength;
              if (byteLength > maximumByteLength) {
                throw CmsError.InvalidInput.make({ message: "Asset exceeds the configured byte limit" });
              }
              // oxlint-disable-next-line typescript/no-floating-promises -- [EH-343] Bun file writers accept fire-and-forget chunk writes during synchronous hashing.
              writer.write(chunk);
              hasher.update(chunk);
            },
          }),
        ).pipe(
          Effect.flatMap(() =>
            Effect.tryPromise({
              catch: (cause) =>
                CmsError.InfrastructureFailure.make({
                  cause,
                  message: "Local asset blob staging finalize failed",
                  retryable: true,
                }),
              // oxlint-disable-next-line effecttsgo/async-function -- [EH-339] Bun file writers finalize through native promise callbacks.
              try: async () => {
                await writer.end();
                const digest = hasher.digest("hex"),
                  blobPath = joinPath(blobsDirectory, digest),
                  blobExists = await Bun.file(blobPath).exists();
                if (blobExists) {
                  await rm(stagePath, { force: true });
                } else {
                  await rename(stagePath, blobPath);
                }
                return { byteLength, digest };
              },
            }),
          ),
          Effect.tapError(() =>
            Effect.tryPromise({
              catch: () =>
                CmsError.InfrastructureFailure.make({
                  message: "Local asset blob staging cleanup failed",
                  retryable: false,
                }),
              // oxlint-disable-next-line effecttsgo/async-function -- [EH-340] failed blob commits clean up staged files through native promise callbacks.
              try: async () => {
                await writer.end();
                await rm(stagePath, { force: true });
              },
            }).pipe(Effect.ignore),
          ),
        );
        return commitResult;
      }),
    readBlobStream = (
      digest: string,
      byteLength: number,
    ): Stream.Stream<Uint8Array, CmsError.InfrastructureFailure> => {
      const blobPath = joinPath(blobsDirectory, digest);
      return Stream.fromAsyncIterable(
        // oxlint-disable-next-line effecttsgo/async-function -- [EH-315] Bun file reads are exposed through an async iterable stream adapter.
        (async function* readLocalAssetBlob() {
          const file = Bun.file(blobPath);
          if (!(await file.exists())) {
            throw CmsError.InfrastructureFailure.make({
              message: `Local asset blob ${digest} was not found`,
              retryable: false,
            });
          }
          const contents = new Uint8Array(await file.arrayBuffer());
          if (contents.byteLength !== byteLength) {
            throw CmsError.InfrastructureFailure.make({
              message: `Local asset blob ${digest} length mismatch`,
              retryable: false,
            });
          }
          yield contents;
        })(),
        (error) =>
          Schema.is(CmsError.InfrastructureFailure)(error)
            ? error
            : CmsError.InfrastructureFailure.make({
                cause: error,
                message: "Local asset blob read failed",
                retryable: true,
              }),
      );
    };
  return {
    commitBlob,
    readBlobStream,
    validateIngestInput,
  };
};

export type LocalAssetBlobStore = ReturnType<typeof localAssetBlobStore>;
