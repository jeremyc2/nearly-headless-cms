import { type IngestInput } from "../../asset.ts";
import { InfrastructureFailure, InvalidInput } from "../../cms-error.ts";
import { type CatalogState } from "../../persistence.ts";
import {
  type Configuration,
  type State,
  defaultAssetMaximumByteLength,
  defaultEntryMaximumByteLength,
  defaultMetadataMaximumByteLength,
  emptyLength,
  stagingPrefix,
} from "./bun-filesystem-persistence-types.ts";
import { Effect, Stream } from "effect";
// oxlint-disable-next-line effecttsgo/node-builtin-import -- Bun does not provide a path manipulation API; these operations are platform-neutral string handling.
import { basename, join } from "node:path";
// oxlint-disable-next-line effecttsgo/node-builtin-import -- This Bun adapter needs durable fsync/open and directory primitives unavailable in Effect's portable FileSystem layer.
import { open, rename, rm } from "node:fs/promises";

const assetStageEndPromise = (stage: {
  readonly ended: boolean;
  readonly writer: ReturnType<ReturnType<typeof Bun.file>["writer"]>;
}): Promise<void> => {
  if (stage.ended) {
    return Promise.resolve();
  }
  return Promise.resolve(stage.writer.end())
    .then(() => {})
    .catch(() => {});
},
  cleanupAssetStage = (
    stage: { ended: boolean; writer: ReturnType<ReturnType<typeof Bun.file>["writer"]> },
    stagePath: string,
  ): Promise<void> =>
    assetStageEndPromise(stage).then(() => rm(stagePath, { force: true }).catch(() => {})),
  cloneCatalog = (catalog: CatalogState): CatalogState => ({
    ...catalog,
    active: { ...catalog.active, input: structuredClone(catalog.active.input) },
    events: structuredClone(catalog.events),
    migrationManifests: structuredClone(catalog.migrationManifests),
    migrationPreparations: structuredClone(catalog.migrationPreparations),
    retiredDefinitionIds: new Set(catalog.retiredDefinitionIds),
    revisions: structuredClone(catalog.revisions),
    snapshots: catalog.snapshots.map((snapshot) => ({
      ...snapshot,
      input: structuredClone(snapshot.input),
    })),
  }),
  cloneState = (state: State): State => {
    const clonedState: State = {
      assets: new Map(
        [...state.assets].map(([assetId, asset]) => [assetId, structuredClone(asset)]),
      ),
      entryGeneration: state.entryGeneration,
      generation: state.generation,
      records: new Map(
        [...state.records].map(([entryId, record]) => [entryId, structuredClone(record)]),
      ),
    };
    if (state.catalog === undefined) {
      return clonedState;
    }
    return { ...clonedState, catalog: cloneCatalog(state.catalog) };
  },
  commitAssetBlob = (
    configuration: Configuration,
    content: IngestInput["content"],
  ): Effect.Effect<
    { readonly byteLength: number; readonly digest: string },
    InfrastructureFailure | InvalidInput
  > => {
    const blobsDirectory = join(configuration.root, "blobs"),
      contentStream = contentStreamFromInput(content),
      maximumByteLength = configuration.maximumAssetByteLength ?? defaultAssetMaximumByteLength,
      // oxlint-disable-next-line effecttsgo/crypto-random-uuid -- staging paths are computed before the Effect stream starts and must remain synchronous.
      stagePath = join(blobsDirectory, `${stagingPrefix}blob-${crypto.randomUUID()}`);
    return Effect.acquireUseRelease(
      fromPromise(
        () =>
          Promise.resolve({
            ended: false,
            writer: Bun.file(stagePath).writer({ highWaterMark: 65_536 }),
          }),
        "Filesystem Asset staging file creation failed",
      ),
      (stage) =>
        writeAssetBlobBody({
          blobsDirectory,
          configuration,
          contentStream,
          maximumByteLength,
          stage,
          stagePath,
        }),
      (stage) =>
        fromPromise(
          () => cleanupAssetStage(stage, stagePath),
          "Filesystem Asset staging cleanup failed",
        ).pipe(Effect.ignore),
    );
  },
  commitOrCleanupBlob = (input: {
    readonly assetDigest: string;
    readonly blobsDirectory: string;
    readonly configuration: Configuration;
    readonly stagePath: string;
  }): Promise<void> => {
    const blobPath = join(input.blobsDirectory, input.assetDigest);
    return Bun.file(blobPath)
      .exists()
      .then((blobExists) => {
        if (blobExists) {
          return rm(input.stagePath, { force: true });
        }
        return rename(input.stagePath, blobPath).then(
          // oxlint-disable-next-line effecttsgo/async-function -- durable blob commits use Promise-based filesystem synchronization.
          async () => {
          if (input.configuration.acknowledgement === "durable") {
            await synchronize(input.blobsDirectory);
          }
        },
        );
      });
  },
  contentStreamFromInput = (
    content: IngestInput["content"],
  ): Stream.Stream<Uint8Array, InfrastructureFailure> => {
    if (content instanceof Uint8Array) {
      return Stream.make(content);
    }
    return content;
  },
  digest = (bytes: Uint8Array): string => {
    const hasher = new Bun.CryptoHasher("sha256");
    hasher.update(bytes);
    return hasher.digest("hex");
  },
  encode = (value: unknown): Uint8Array => new TextEncoder().encode(`${JSON.stringify(value)}\n`),
  failure = (message: string, cause: unknown, retryable = false): InfrastructureFailure =>
    InfrastructureFailure.make({ cause, message, retryable }),
  filesystemErrorCode = (error: unknown): string | undefined => {
    if (typeof error !== "object" || error === null || !("code" in error)) {
      return undefined;
    }
    if (typeof error.code === "string") {
      return error.code;
    }
    return undefined;
  },
  finalizeAssetStaging = (
    configuration: Configuration,
    stagePath: string,
    stage: { ended: boolean; writer: ReturnType<ReturnType<typeof Bun.file>["writer"]> },
  ): Promise<void> =>
    // oxlint-disable-next-line effecttsgo/async-function -- Asset staging finalization coordinates Bun writer flush and fsync boundaries.
    Promise.resolve(stage.writer.end()).then(async () => {
      stage.ended = true;
      if (configuration.acknowledgement === "durable") {
        await synchronize(stagePath);
      }
    }),
  fromPromise = <Value>(
    operation: () => Promise<Value>,
    message: string,
  ): Effect.Effect<Value, InfrastructureFailure> =>
    Effect.tryPromise({
      catch: (cause) => failure(message, cause),
      try: operation,
    }),
  // oxlint-disable-next-line effecttsgo/async-function -- Bun filesystem handles expose Promise-based synchronization boundaries.
  synchronize = async (path: string): Promise<void> => {
    const handle = await open(path, "r");
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
  },
  writeAssetBlobBody = (input: {
    readonly blobsDirectory: string;
    readonly configuration: Configuration;
    readonly contentStream: Stream.Stream<Uint8Array, InfrastructureFailure>;
    readonly maximumByteLength: number;
    readonly stage: { ended: boolean; writer: ReturnType<ReturnType<typeof Bun.file>["writer"]> };
    readonly stagePath: string;
  }): Effect.Effect<
    { readonly byteLength: number; readonly digest: string },
    InfrastructureFailure | InvalidInput
  > =>
    Effect.gen(function* writeAssetBlob() {
      const byteLength = { current: emptyLength },
        hasher = new Bun.CryptoHasher("sha256");
      yield* Stream.runForEach(input.contentStream, (chunk) =>
        writeAssetChunk({
          byteLength,
          chunk,
          hasher,
          maximumByteLength: input.maximumByteLength,
          stage: input.stage,
        }),
      );
      yield* fromPromise(
        () => finalizeAssetStaging(input.configuration, input.stagePath, input.stage),
        "Filesystem Asset staging finalization failed",
      );
      return yield* fromPromise(
        () => {
          const assetDigest = hasher.digest("hex");
          return commitOrCleanupBlob({
            assetDigest,
            blobsDirectory: input.blobsDirectory,
            configuration: input.configuration,
            stagePath: input.stagePath,
          }).then(() => ({ byteLength: byteLength.current, digest: assetDigest }));
        },
        "Filesystem Asset Blob commit failed",
      );
    }),
  writeAssetChunk = (input: {
    readonly byteLength: { current: number };
    readonly chunk: Uint8Array;
    readonly hasher: Bun.CryptoHasher;
    readonly maximumByteLength: number;
    readonly stage: { ended: boolean; writer: ReturnType<ReturnType<typeof Bun.file>["writer"]> };
  }): Effect.Effect<void, InfrastructureFailure | InvalidInput> => {
    const nextByteLength = input.byteLength.current + input.chunk.byteLength;
    if (nextByteLength > input.maximumByteLength) {
      return Effect.fail(
        InvalidInput.make({ message: "Asset bytes exceed the configured limit" }),
      );
    }
    return fromPromise(
      () =>
        Promise.resolve().then(() => {
          input.hasher.update(input.chunk);
          return Promise.resolve(input.stage.writer.write(input.chunk)).then(() => {
            input.byteLength.current = nextByteLength;
            return input.stage.writer.flush();
          });
        }),
      "Filesystem Asset staging write failed",
    );
  },
  // oxlint-disable-next-line effecttsgo/async-function -- Atomic persistence coordinates Bun and node filesystem promises.
  writeAtomic = async (
    path: string,
    bytes: Uint8Array,
    acknowledgement: Configuration["acknowledgement"],
  ): Promise<void> => {
    const parentDirectory = path.slice(0, Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"))),
      // oxlint-disable-next-line effecttsgo/crypto-random-uuid -- staging paths are built synchronously in Bun's filesystem bridge.
      stagePath = join(parentDirectory, `${stagingPrefix}${basename(path)}-${crypto.randomUUID()}`);
    try {
      await Bun.write(stagePath, bytes);
      if (acknowledgement === "durable") {
        await synchronize(stagePath);
      }
      await rename(stagePath, path);
      if (acknowledgement === "durable") {
        await synchronize(parentDirectory);
      }
    } catch (error) {
      await rm(stagePath, { force: true }).catch(() => {});
      throw error;
    }
  };

export default {
  cloneCatalog,
  cloneState,
  commitAssetBlob,
  defaultEntryMaximumByteLength,
  defaultMetadataMaximumByteLength,
  digest,
  encode,
  failure,
  filesystemErrorCode,
  fromPromise,
  synchronize,
  writeAtomic,
};
