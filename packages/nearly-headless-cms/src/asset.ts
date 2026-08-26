import type {
  AssetReferenced,
  InfrastructureFailure,
  InvalidInput,
  NotFound,
} from "./cms-error.ts";
import { Context, type Effect, type Stream } from "effect";

/** Immutable metadata recorded for an Asset Blob. */
export interface Metadata {
  readonly filename: string;
  readonly mediaType: string;
  readonly byteLength: number;
  readonly digest: string;
  readonly width?: number;
  readonly height?: number;
  readonly defaultAlternativeText?: string;
}

/** An Asset identifier paired with its immutable metadata. */
export interface Asset {
  readonly id: string;
  readonly metadata: Metadata;
}

/** Input for bounded, digest-addressed Asset ingestion. */
export interface IngestInput {
  readonly filename: string;
  readonly mediaType: string;
  readonly content: Uint8Array | Stream.Stream<Uint8Array, InfrastructureFailure>;
  readonly width?: number;
  readonly height?: number;
  readonly defaultAlternativeText?: string;
}

/** An Asset value with a one-shot stream of verified bytes. */
export interface StoredAsset extends Asset {
  readonly content: Stream.Stream<Uint8Array, InfrastructureFailure>;
}

/** Builder-supplied Asset persistence and retrieval capability. */
export class Management extends Context.Service<
  Management,
  {
    readonly ingest: <Input extends IngestInput>(
      input: Readonly<Input>,
    ) => Effect.Effect<Asset, InvalidInput | InfrastructureFailure>;
    readonly get: (assetId: string) => Effect.Effect<Asset, NotFound | InfrastructureFailure>;
    readonly read: (
      assetId: string,
    ) => Effect.Effect<StoredAsset, NotFound | InfrastructureFailure>;
    readonly delete: (
      assetId: string,
    ) => Effect.Effect<void, NotFound | AssetReferenced | InfrastructureFailure>;
    readonly list: (_void: void) => Effect.Effect<readonly Asset[], InfrastructureFailure>;
  }
>()("nearly-headless-cms/asset/Management") {}
