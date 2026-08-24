import type { Effect, Stream } from "effect";
import { Context } from "effect";
import type {
  AssetReferenced,
  InfrastructureFailure,
  InvalidInput,
  NotFound,
} from "./cms-error.ts";

export interface Metadata {
  readonly filename: string;
  readonly mediaType: string;
  readonly byteLength: number;
  readonly digest: string;
  readonly width?: number;
  readonly height?: number;
  readonly defaultAlternativeText?: string;
}

export interface Asset {
  readonly id: string;
  readonly metadata: Metadata;
}

export interface IngestInput {
  readonly filename: string;
  readonly mediaType: string;
  readonly content: Uint8Array | Stream.Stream<Uint8Array, InfrastructureFailure>;
  readonly width?: number;
  readonly height?: number;
  readonly defaultAlternativeText?: string;
}

export interface StoredAsset extends Asset {
  readonly bytes: Uint8Array;
}

export class Management extends Context.Service<
  Management,
  {
    readonly ingest: (
      input: IngestInput,
    ) => Effect.Effect<Asset, InvalidInput | InfrastructureFailure>;
    readonly get: (assetId: string) => Effect.Effect<Asset, NotFound | InfrastructureFailure>;
    readonly read: (
      assetId: string,
    ) => Effect.Effect<StoredAsset, NotFound | InfrastructureFailure>;
    readonly delete: (
      assetId: string,
    ) => Effect.Effect<void, NotFound | AssetReferenced | InfrastructureFailure>;
    readonly list: Effect.Effect<readonly Asset[], InfrastructureFailure>;
  }
>()("nearly-headless-cms/Asset/Management") {}
