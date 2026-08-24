import { createHash } from "node:crypto";
import { Effect, Layer, Stream, SynchronizedRef } from "effect";
import { type Asset, Management, type StoredAsset } from "../asset.ts";
import { type InfrastructureFailure, InvalidInput, NotFound } from "../cms-error.ts";
import { Generator } from "../identifier.ts";

const DEFAULT_MAXIMUM_BYTE_LENGTH = 25_000_000,
  DEFAULT_MAXIMUM_METADATA_BYTE_LENGTH = 16_384,
  EMPTY_BYTE_LENGTH = 0;

/** Bounds for the in-memory development Asset Adapter. */
export interface Options {
  readonly maximumByteLength?: number;
  readonly maximumMetadataByteLength?: number;
}

const collectBytes = (
  content: Uint8Array | Stream.Stream<Uint8Array, InfrastructureFailure>,
): Effect.Effect<Uint8Array, InfrastructureFailure> => {
  if (content instanceof Uint8Array) {
    return Effect.succeed(content.slice());
  }
  return Stream.runCollect(content).pipe(
    Effect.map((arrays) => {
      const combined = new Uint8Array(
        arrays.reduce((total, bytes) => total + bytes.byteLength, EMPTY_BYTE_LENGTH),
      );
      let offset = EMPTY_BYTE_LENGTH;
      for (const bytes of arrays) {
        combined.set(bytes, offset);
        offset += bytes.byteLength;
      }
      return combined;
    }),
  );
};

/** Creates a process-local, non-durable Asset Management Layer. */
export const layer = (options: Options = {}): Layer.Layer<Management, never, Generator> =>
  Layer.effect(
    Management,
    Effect.gen(function* makeMemoryAssetManagement() {
      const identifiers = yield* Generator,
        maximumByteLength = options.maximumByteLength ?? DEFAULT_MAXIMUM_BYTE_LENGTH,
        maximumMetadataByteLength =
          options.maximumMetadataByteLength ?? DEFAULT_MAXIMUM_METADATA_BYTE_LENGTH,
        state = yield* SynchronizedRef.make<ReadonlyMap<string, StoredAsset>>(new Map());
      return Management.of({
        delete: (assetId) =>
          SynchronizedRef.modifyEffect(state, (assets) => {
            if (!assets.has(assetId)) {
              return Effect.fail(NotFound.make({ message: `Asset ${assetId} was not found` }));
            }
            const updated = new Map(assets);
            updated.delete(assetId);
            return Effect.succeed([undefined, updated] as const);
          }),
        get: (assetId) =>
          SynchronizedRef.get(state).pipe(
            Effect.flatMap((assets) => {
              const asset = assets.get(assetId);
              if (asset === undefined) {
                return Effect.fail(NotFound.make({ message: `Asset ${assetId} was not found` }));
              }
              return Effect.succeed<Asset>({ id: asset.id, metadata: asset.metadata });
            }),
          ),
        ingest: (input) =>
          Effect.gen(function* ingest() {
            if (
              input.filename.trim().length === EMPTY_BYTE_LENGTH ||
              !input.mediaType.includes("/")
            ) {
              return yield* InvalidInput.make({
                message: "Asset filename and media type are required",
              });
            }
            if (
              new TextEncoder().encode(JSON.stringify({ ...input, content: undefined }))
                .byteLength > maximumMetadataByteLength
            ) {
              return yield* InvalidInput.make({
                message: "Asset metadata exceeds the configured limit",
              });
            }
            const bytes = yield* collectBytes(input.content);
            if (bytes.byteLength > maximumByteLength) {
              return yield* InvalidInput.make({
                message: "Asset bytes exceed the configured limit",
              });
            }
            const assetIdentifier = yield* identifiers.generate("asset"),
              digest = createHash("sha256").update(bytes).digest("hex"),
              stored: StoredAsset = {
                bytes,
                id: assetIdentifier,
                metadata: {
                  byteLength: bytes.byteLength,
                  digest,
                  filename: input.filename,
                  mediaType: input.mediaType,
                  ...(input.width === undefined ? {} : { width: input.width }),
                  ...(input.height === undefined ? {} : { height: input.height }),
                  ...(input.defaultAlternativeText === undefined
                    ? {}
                    : { defaultAlternativeText: input.defaultAlternativeText }),
                },
              };
            yield* SynchronizedRef.update(state, (assets) =>
              new Map(assets).set(assetIdentifier, stored),
            );
            return { id: stored.id, metadata: stored.metadata };
          }),
        list: SynchronizedRef.get(state).pipe(
          Effect.map((assets) =>
            [...assets.values()].map(({ id, metadata }) => ({ id, metadata })),
          ),
        ),
        read: (assetId) =>
          SynchronizedRef.get(state).pipe(
            Effect.flatMap((assets) => {
              const asset = assets.get(assetId);
              if (asset === undefined) {
                return Effect.fail(NotFound.make({ message: `Asset ${assetId} was not found` }));
              }
              return Effect.succeed({ ...asset, bytes: asset.bytes.slice() });
            }),
          ),
      });
    }),
  );
