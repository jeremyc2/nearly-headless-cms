import { type Asset, type IngestInput, Management, type Metadata } from "../asset.ts";
import { Effect, Layer, Schema, Stream, SynchronizedRef } from "effect";
import { Generator, type Kind } from "../identifier.ts";
import { InfrastructureFailure, InvalidInput, NotFound } from "../cms-error.ts";
import assetStream from "../asset-stream.ts";
import { createHash } from "node:crypto";

/** Bounds for the in-memory development Asset Adapter. */
export interface Options {
  readonly maximumByteLength?: number;
  readonly maximumMetadataByteLength?: number;
}

interface BufferedAsset extends Asset {
  readonly bytes: Uint8Array;
}

type AssetState = SynchronizedRef.SynchronizedRef<ReadonlyMap<string, BufferedAsset>>;

interface IdentifierGenerator {
  readonly generate: (kind: Kind) => Effect.Effect<string, InfrastructureFailure>;
}

interface MemoryAssetManagementContext {
  readonly identifiers: IdentifierGenerator;
  readonly maximumByteLength: number;
  readonly maximumMetadataByteLength: number;
  readonly state: AssetState;
}

const AssetMetadataInput = Schema.Struct({
    defaultAlternativeText: Schema.optional(Schema.String),
    filename: Schema.String,
    height: Schema.optional(Schema.Finite),
    mediaType: Schema.String,
    width: Schema.optional(Schema.Finite),
  }),
  DEFAULT_MAXIMUM_BYTE_LENGTH = 25_000_000,
  DEFAULT_MAXIMUM_METADATA_BYTE_LENGTH = 16_384,
  EMPTY_BYTE_LENGTH = 0,
  { oneShot } = assetStream,
  collectBytes = <Content extends Uint8Array | Stream.Stream<Uint8Array, InfrastructureFailure>>(
    content: Content,
  ): Content extends Uint8Array
    ? Effect.Effect<Uint8Array, InfrastructureFailure>
    : Effect.Effect<Uint8Array, InfrastructureFailure> => {
    if (content instanceof Uint8Array) {
      return Effect.succeed(content);
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
  },
  createManagementService = <Context extends MemoryAssetManagementContext>(
    context: Readonly<Context>,
  ) =>
    Management.of({
      delete: deleteAssetMethod(context.state),
      get: getAssetMethod(context.state),
      ingest: ingestAssetMethod(context),
      list: (_void: void) => listAssetsMethod(context.state),
      read: readAssetMethod(context.state),
    }),
  deleteAssetMethod =
    <State extends AssetState>(state: Readonly<State>) =>
    (assetId: string): Effect.Effect<void, NotFound> =>
      SynchronizedRef.modifyEffect(state, (assets) => {
        if (!assets.has(assetId)) {
          return Effect.fail(NotFound.make({ message: `Asset ${assetId} was not found` }));
        }
        const updated = new Map(assets);
        updated.delete(assetId);
        return Effect.succeed([undefined, updated] as const);
      }),
  encodeMetadataInput = (
    input: Readonly<{
      defaultAlternativeText?: string;
      filename: string;
      height?: number;
      mediaType: string;
      width?: number;
    }>,
    maximumMetadataByteLength: number,
  ) =>
    Effect.gen(function* validateEncodedMetadata() {
      const metadataPayload: {
        defaultAlternativeText?: string;
        filename: string;
        height?: number;
        mediaType: string;
        width?: number;
      } = {
        filename: input.filename,
        mediaType: input.mediaType,
      };
      if (input.width !== undefined) {
        metadataPayload.width = input.width;
      }
      if (input.height !== undefined) {
        metadataPayload.height = input.height;
      }
      if (input.defaultAlternativeText !== undefined) {
        metadataPayload.defaultAlternativeText = input.defaultAlternativeText;
      }
      if (
        new TextEncoder().encode(
          yield* Schema.encodeEffect(Schema.fromJsonString(AssetMetadataInput))(
            metadataPayload,
          ).pipe(Effect.orDie),
        ).byteLength > maximumMetadataByteLength
      ) {
        return yield* InvalidInput.make({
          message: "Asset metadata exceeds the configured limit",
        });
      }
      return metadataPayload;
    }),
  getAssetMethod =
    <State extends AssetState>(state: Readonly<State>) =>
    (assetId: string): Effect.Effect<Asset, NotFound> =>
      SynchronizedRef.get(state).pipe(
        Effect.flatMap((assets) => {
          const asset = assets.get(assetId);
          if (asset === undefined) {
            return Effect.fail(NotFound.make({ message: `Asset ${assetId} was not found` }));
          }
          return Effect.succeed<Asset>({ id: asset.id, metadata: asset.metadata });
        }),
      ),
  ingestAssetMethod =
    <Context extends MemoryAssetManagementContext>(context: Readonly<Context>) =>
    <Input extends IngestInput>(input: Readonly<Input>) =>
      Effect.gen(function* ingest() {
        if (input.filename.trim().length === EMPTY_BYTE_LENGTH || !input.mediaType.includes("/")) {
          return yield* InvalidInput.make({
            message: "Asset filename and media type are required",
          });
        }
        yield* encodeMetadataInput(input, context.maximumMetadataByteLength);
        const bytes = yield* collectBytes(input.content);
        if (bytes.byteLength > context.maximumByteLength) {
          return yield* InvalidInput.make({
            message: "Asset bytes exceed the configured limit",
          });
        }
        return yield* persistIngestedAsset(context, input, bytes);
      }),
  layer = (options: Readonly<Options> = {}): Layer.Layer<Management, never, Generator> =>
    Layer.effect(
      Management,
      Effect.gen(function* makeMemoryAssetManagement() {
        const identifiers = yield* Generator,
          maximumByteLength = options.maximumByteLength ?? DEFAULT_MAXIMUM_BYTE_LENGTH,
          maximumMetadataByteLength =
            options.maximumMetadataByteLength ?? DEFAULT_MAXIMUM_METADATA_BYTE_LENGTH,
          state = yield* SynchronizedRef.make<ReadonlyMap<string, BufferedAsset>>(new Map());
        return createManagementService({
          identifiers,
          maximumByteLength,
          maximumMetadataByteLength,
          state,
        });
      }),
    ),
  listAssetsMethod = <State extends AssetState>(state: Readonly<State>) =>
    SynchronizedRef.get(state).pipe(
      Effect.map((assets) => [...assets.values()].map(({ id, metadata }) => ({ id, metadata }))),
    ),
  makeAssetContent = <Bytes extends Uint8Array>(bytes: Readonly<Bytes>) => {
    const content = Stream.make(new Uint8Array(bytes));
    return oneShot(content, repeatedAssetContentFailure);
  },
  makeMetadata = <Bytes extends Uint8Array>(
    input: Readonly<{
      defaultAlternativeText?: string;
      filename: string;
      height?: number;
      mediaType: string;
      width?: number;
    }>,
    bytes: Readonly<Bytes>,
    digest: string,
  ): Metadata => {
    const metadata: Metadata = {
      byteLength: bytes.byteLength,
      digest,
      filename: input.filename,
      mediaType: input.mediaType,
    };
    if (input.width !== undefined) {
      Object.assign(metadata, { width: input.width });
    }
    if (input.height !== undefined) {
      Object.assign(metadata, { height: input.height });
    }
    if (input.defaultAlternativeText !== undefined) {
      Object.assign(metadata, { defaultAlternativeText: input.defaultAlternativeText });
    }
    return metadata;
  },
  persistIngestedAsset = <
    Context extends MemoryAssetManagementContext,
    Input extends IngestInput,
    Bytes extends Uint8Array,
  >(
    context: Readonly<Context>,
    input: Readonly<Input>,
    bytes: Readonly<Bytes>,
  ) =>
    Effect.gen(function* persistIngestedAssetEffect() {
      const assetIdentifier = yield* context.identifiers.generate("asset"),
        digest = createHash("sha256").update(bytes).digest("hex"),
        metadata = makeMetadata(input, bytes, digest),
        stored: BufferedAsset = {
          bytes,
          id: assetIdentifier,
          metadata,
        };
      yield* SynchronizedRef.update(context.state, (assets) =>
        new Map(assets).set(assetIdentifier, stored),
      );
      return { id: stored.id, metadata: stored.metadata };
    }),
  readAssetMethod =
    <State extends AssetState>(state: Readonly<State>) =>
    (assetId: string) =>
      SynchronizedRef.get(state).pipe(
        Effect.flatMap((assets) => {
          const asset = assets.get(assetId);
          if (asset === undefined) {
            return Effect.fail(NotFound.make({ message: `Asset ${assetId} was not found` }));
          }
          return Effect.succeed({
            content: makeAssetContent(asset.bytes),
            id: asset.id,
            metadata: asset.metadata,
          });
        }),
      ),
  repeatedAssetContentFailure = (): InfrastructureFailure =>
    InfrastructureFailure.make({
      cause: new Error("stream already consumed"),
      message: "Asset content stream has already been consumed",
      retryable: false,
    });

/** Creates a bounded process-local Asset Management Layer. */
export { layer };
