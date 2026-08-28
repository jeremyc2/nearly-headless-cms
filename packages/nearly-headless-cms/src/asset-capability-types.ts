import type { Asset, IngestInput, StoredAsset } from "./asset.ts";
import type { InfrastructureFailure, InvalidInput } from "./cms-error.ts";
import type { Effect } from "effect";

/** Asset metadata supplied before an upload mechanism is selected. */
export type NewAssetMetadata = Omit<IngestInput, "content">;

/** Bytes supplied to a direct-stream upload intent. */
export interface DirectStreamIngestInput {
  readonly content: IngestInput["content"];
}

/** Upload intent that accepts bytes through the CMS process. */
export interface DirectStreamUpload {
  readonly kind: "direct-stream";
  readonly ingest: <Input extends DirectStreamIngestInput>(
    input: Readonly<Input>,
  ) => Effect.Effect<Asset, InvalidInput | InfrastructureFailure>;
}

/** Upload intent that sends bytes directly to an external object store. */
export interface PresignedUrlUpload {
  readonly assetId: string;
  readonly expiresInMilliseconds: number;
  readonly headers?: Readonly<Record<string, string>>;
  readonly kind: "presigned-url";
  readonly method: "PUT";
  readonly url: string;
}

/** Adapter-selected upload mechanism. */
export type UploadTarget = DirectStreamUpload | PresignedUrlUpload;

/** Download intent that streams bytes through the CMS process. */
export interface DirectStreamDownload extends StoredAsset {
  readonly kind: "direct-stream";
}

/** Download intent that redirects the caller to an external object store. */
export interface RedirectUrlDownload {
  readonly kind: "redirect-url";
  readonly url: string;
}

/** Adapter-selected download mechanism. */
export type DownloadTarget = DirectStreamDownload | RedirectUrlDownload;
