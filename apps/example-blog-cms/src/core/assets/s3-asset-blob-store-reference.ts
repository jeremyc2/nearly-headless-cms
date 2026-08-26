import type { Asset } from "nearly-headless-cms";

/**
 * Reference sketch for AWS S3-backed asset blob storage.
 *
 * Production wiring:
 * - `PutObjectCommand` on ingest (key = digest)
 * - `GetObjectCommand` streaming read
 * - `DeleteObjectCommand` on asset deletion when unreferenced
 * - Metadata index remains in SQL (see `sql-persistence-services.ts`)
 *
 * Swap `localAssetBlobStore` in composition for an implementation of this interface.
 */
export interface S3AssetBlobStoreReference {
  readonly commitBlob: (
    input: Asset.IngestInput,
  ) => Promise<{ readonly byteLength: number; readonly digest: string }>;
  readonly readBlobStream: (digest: string) => AsyncIterable<Uint8Array>;
}

// oxlint-disable-next-line effecttsgo/missing-pipeable-signature -- [EH-324] Asset metadata assembly is a pure helper at the storage adapter boundary.
export const buildAssetMetadata = (
  input: Asset.IngestInput,
  committedBlob: { readonly byteLength: number; readonly digest: string },
): Asset.Metadata => {
  let metadata: Asset.Metadata = {
    byteLength: committedBlob.byteLength,
    digest: committedBlob.digest,
    filename: input.filename,
    mediaType: input.mediaType,
  };
  if (input.width !== undefined) {
    metadata = { ...metadata, width: input.width };
  }
  if (input.height !== undefined) {
    metadata = { ...metadata, height: input.height };
  }
  if (input.defaultAlternativeText !== undefined) {
    metadata = { ...metadata, defaultAlternativeText: input.defaultAlternativeText };
  }
  return metadata;
};

/** Placeholder showing the S3 SDK surface; not wired in the local POC. */
export const s3AssetBlobStoreReference = (): S3AssetBlobStoreReference => ({
  commitBlob: () =>
    Promise.reject(
      new Error(
        "S3 asset storage is not enabled in the local POC. Use localAssetBlobStore instead.",
      ),
    ),
  readBlobStream: () => ({
    // oxlint-disable-next-line effecttsgo/async-function -- [EH-344] async generator stub matches AssetBlobStore stream contract.
    [Symbol.asyncIterator]: async function* readBlobStream() {
      yield* [];
      throw new Error(
        "S3 asset storage is not enabled in the local POC. Use localAssetBlobStore instead.",
      );
    },
  }),
});
