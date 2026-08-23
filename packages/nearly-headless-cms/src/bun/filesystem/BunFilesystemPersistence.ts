import { createHash } from "node:crypto";
import { mkdir, open, readdir, rename, rm, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import { Context, Effect, Layer, Stream, SynchronizedRef } from "effect";
import { type IngestInput, Management, type Metadata } from "../../Asset.ts";
import {
  type CmsError,
  Conflict,
  InfrastructureFailure,
  InvalidInput,
  NotFound,
} from "../../CmsError.ts";
import { Generator } from "../../Identifier.ts";
import { type EntryGeneration, EntryPersistence, type EntryRecord } from "../../Persistence.ts";

const storageFormat = "nearly-headless-cms/filesystem",
  storageFormatVersion = 1,
  stagingPrefix = ".nhcms-stage-";

export interface Configuration {
  readonly root: string;
  readonly acknowledgement: "atomic" | "durable";
  readonly maximumEntryEncodingByteLength?: number;
  readonly maximumAssetByteLength?: number;
  readonly maximumMetadataByteLength?: number;
}

interface DiskAsset {
  readonly id: string;
  readonly metadata: Metadata;
}

interface DiskGeneration {
  readonly format: typeof storageFormat;
  readonly version: typeof storageFormatVersion;
  readonly generation: number;
  readonly records: readonly (readonly [string, EntryRecord])[];
  readonly assets: readonly DiskAsset[];
}

interface DiskManifest {
  readonly format: typeof storageFormat;
  readonly version: typeof storageFormatVersion;
  readonly generation: number;
  readonly generationFile: string;
  readonly generationDigest: string;
}

interface State {
  readonly generation: number;
  readonly records: ReadonlyMap<string, EntryRecord>;
  readonly assets: ReadonlyMap<string, DiskAsset>;
}

interface Acquired {
  readonly context: Context.Context<EntryPersistence | Management>;
  readonly lockPath: string;
}

const failure = (message: string, cause: unknown, retryable = false): InfrastructureFailure =>
    new InfrastructureFailure({ cause, message, retryable }),
  fromPromise = <Value>(
    operation: () => Promise<Value>,
    message: string,
  ): Effect.Effect<Value, InfrastructureFailure> =>
    Effect.tryPromise({
      catch: (cause) => failure(message, cause),
      try: operation,
    }),
  digest = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex"),
  encode = (value: unknown): Uint8Array => new TextEncoder().encode(`${JSON.stringify(value)}\n`),
  collectBytes = (
    input: IngestInput["content"],
    maximumByteLength: number,
  ): Effect.Effect<Uint8Array, InfrastructureFailure | InvalidInput> => {
    if (input instanceof Uint8Array) {
      return input.byteLength > maximumByteLength
        ? Effect.fail(new InvalidInput({ message: "Asset bytes exceed the configured limit" }))
        : Effect.succeed(input.slice());
    }
    return Stream.runFoldEffect(
      input,
      () => ({ chunks: [] as Uint8Array[], totalByteLength: 0 }),
      (state, chunk) => {
        const totalByteLength = state.totalByteLength + chunk.byteLength;
        return totalByteLength > maximumByteLength
          ? Effect.fail(new InvalidInput({ message: "Asset bytes exceed the configured limit" }))
          : Effect.succeed({ chunks: [...state.chunks, chunk.slice()], totalByteLength });
      },
    ).pipe(
      Effect.map(({ chunks, totalByteLength }) => {
        const bytes = new Uint8Array(totalByteLength);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.byteLength;
        }
        return bytes;
      }),
    );
  },
  cloneState = (state: State): State => ({
    assets: new Map([...state.assets].map(([assetId, asset]) => [assetId, structuredClone(asset)])),
    generation: state.generation,
    records: new Map(
      [...state.records].map(([entryId, record]) => [entryId, structuredClone(record)]),
    ),
  }),
  synchronize = async (path: string): Promise<void> => {
    const handle = await open(path, "r");
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
  },
  writeAtomic = async (
    path: string,
    bytes: Uint8Array,
    acknowledgement: Configuration["acknowledgement"],
  ): Promise<void> => {
    const parentDirectory = path.slice(0, Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"))),
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
      await rm(stagePath, { force: true }).catch(() => undefined);
      throw error;
    }
  },
  persistState = async (configuration: Configuration, state: State): Promise<void> => {
    const generationsDirectory = join(configuration.root, "generations"),
      generationName = `generation-${String(state.generation).padStart(16, "0")}.json`,
      generationPath = join(generationsDirectory, generationName),
      generation: DiskGeneration = {
        assets: [...state.assets.values()],
        format: storageFormat,
        generation: state.generation,
        records: [...state.records],
        version: storageFormatVersion,
      },
      generationBytes = encode(generation);
    await writeAtomic(generationPath, generationBytes, configuration.acknowledgement);
    const manifest: DiskManifest = {
      format: storageFormat,
      generation: state.generation,
      generationDigest: digest(generationBytes),
      generationFile: `generations/${generationName}`,
      version: storageFormatVersion,
    };
    await writeAtomic(
      join(configuration.root, "manifest.json"),
      encode(manifest),
      configuration.acknowledgement,
    );
  },
  readJson = async <Value>(path: string): Promise<Value> => {
    const file = Bun.file(path);
    if (!(await file.exists())) {
      throw new Error(`Missing committed file ${basename(path)}`);
    }
    return (await file.json()) as Value;
  },
  removeAbandonedStaging = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.name.startsWith(stagingPrefix)) {
        await rm(path, { force: true, recursive: entry.isDirectory() });
      } else if (entry.isDirectory() && ["generations", "blobs"].includes(entry.name)) {
        await removeAbandonedStaging(path);
      }
    }
  },
  initializeRoot = async (configuration: Configuration): Promise<State> => {
    await mkdir(configuration.root, { recursive: true });
    await mkdir(join(configuration.root, "generations"), { recursive: true });
    await mkdir(join(configuration.root, "blobs"), { recursive: true });
    await removeAbandonedStaging(configuration.root);
    const formatPath = join(configuration.root, "format.json"),
      manifestPath = join(configuration.root, "manifest.json"),
      formatFile = Bun.file(formatPath);
    if (!(await formatFile.exists())) {
      const unexpected = (await readdir(configuration.root)).filter(
        (name) => !["generations", "blobs", "writer.lock"].includes(name),
      );
      if (unexpected.length > 0) {
        throw new Error("Filesystem Persistence root is not empty");
      }
      await writeAtomic(
        formatPath,
        encode({ format: storageFormat, version: storageFormatVersion }),
        configuration.acknowledgement,
      );
      const state: State = { assets: new Map(), generation: 0, records: new Map() };
      await persistState(configuration, state);
      return state;
    }
    const marker = await readJson<{ readonly format?: string; readonly version?: number }>(
      formatPath,
    );
    if (marker.format !== storageFormat || marker.version !== storageFormatVersion) {
      throw new Error("Filesystem Persistence format is incompatible");
    }
    const rootEntries = await readdir(configuration.root),
      unexpected = rootEntries.filter(
        (name) =>
          !["format.json", "manifest.json", "generations", "blobs", "writer.lock"].includes(name),
      );
    if (unexpected.length > 0) {
      throw new Error("Filesystem Persistence root contains unexpected data");
    }
    const manifest = await readJson<DiskManifest>(manifestPath);
    if (
      manifest.format !== storageFormat ||
      manifest.version !== storageFormatVersion ||
      !/^generations\/generation-\d{16}\.json$/u.test(manifest.generationFile)
    ) {
      throw new Error("Filesystem Persistence manifest is corrupt");
    }
    const generationPath = join(configuration.root, manifest.generationFile),
      generationBytes = new Uint8Array(await Bun.file(generationPath).arrayBuffer());
    if (digest(generationBytes) !== manifest.generationDigest) {
      throw new Error("Committed generation digest mismatch");
    }
    const generation = JSON.parse(new TextDecoder().decode(generationBytes)) as DiskGeneration;
    if (
      generation.format !== storageFormat ||
      generation.version !== storageFormatVersion ||
      generation.generation !== manifest.generation ||
      !Array.isArray(generation.records) ||
      !Array.isArray(generation.assets)
    ) {
      throw new Error("Committed generation is corrupt");
    }
    return {
      assets: new Map(generation.assets.map((asset) => [asset.id, asset])),
      generation: generation.generation,
      records: new Map(generation.records),
    };
  },
  makeServices = (
    configuration: Configuration,
    identifiers: Generator["Service"],
    initialState: State,
  ): Effect.Effect<Context.Context<EntryPersistence | Management>> =>
    Effect.gen(function* makeServices() {
      const state = yield* SynchronizedRef.make(initialState),
        entryService = EntryPersistence.of({
          commitGeneration: (expectedGeneration, records) =>
            SynchronizedRef.modifyEffect(
              state,
              (current): Effect.Effect<readonly [EntryGeneration, State], CmsError> => {
                if (current.generation !== expectedGeneration)
                  return Effect.fail(
                    new Conflict({ message: "Filesystem Entry generation is stale" }),
                  );
                const next: State = {
                  generation: current.generation + 1,
                  records: new Map(records),
                  assets: current.assets,
                };
                const entryEncodingByteLength = encode([...records]).byteLength;
                if (
                  entryEncodingByteLength >
                  (configuration.maximumEntryEncodingByteLength ?? 50_000_000)
                )
                  return Effect.fail(
                    new InvalidInput({
                      message: "Entry generation exceeds the configured encoding limit",
                    }),
                  );
                return fromPromise(
                  async () => persistState(configuration, next),
                  "Filesystem Entry commit failed",
                ).pipe(
                  Effect.map(
                    () =>
                      [
                        { generation: next.generation, records: cloneState(next).records },
                        next,
                      ] as const,
                  ),
                );
              },
            ),
          readGeneration: SynchronizedRef.get(state).pipe(
            Effect.map((current) => ({
              generation: current.generation,
              records: cloneState(current).records,
            })),
          ),
        }),
        assetService = Management.of({
          delete: (assetId) =>
            SynchronizedRef.modifyEffect(
              state,
              (
                current,
              ): Effect.Effect<readonly [undefined, State], NotFound | InfrastructureFailure> => {
                if (!current.assets.has(assetId))
                  return Effect.fail(new NotFound({ message: `Asset ${assetId} was not found` }));
                const assets = new Map(current.assets);
                assets.delete(assetId);
                const next: State = {
                  generation: current.generation + 1,
                  records: current.records,
                  assets,
                };
                return fromPromise(
                  async () => persistState(configuration, next),
                  "Filesystem Asset deletion commit failed",
                ).pipe(Effect.map(() => [undefined, next] as const));
              },
            ),
          get: (assetId) =>
            SynchronizedRef.get(state).pipe(
              Effect.flatMap((current) => {
                const asset = current.assets.get(assetId);
                return asset === undefined
                  ? Effect.fail(new NotFound({ message: `Asset ${assetId} was not found` }))
                  : Effect.succeed(structuredClone(asset));
              }),
            ),
          ingest: (input) =>
            Effect.gen(function* () {
              if (input.filename.trim().length === 0 || !input.mediaType.includes("/"))
                return yield* Effect.fail(
                  new InvalidInput({ message: "Asset filename and media type are required" }),
                );
              const metadataByteLength = encode({
                filename: input.filename,
                mediaType: input.mediaType,
                width: input.width,
                height: input.height,
                defaultAlternativeText: input.defaultAlternativeText,
              }).byteLength;
              if (metadataByteLength > (configuration.maximumMetadataByteLength ?? 16_384))
                return yield* Effect.fail(
                  new InvalidInput({ message: "Asset metadata exceeds the configured limit" }),
                );
              const bytes = yield* collectBytes(
                input.content,
                configuration.maximumAssetByteLength ?? 25_000_000,
              );
              const assetDigest = digest(bytes);
              const blobPath = join(configuration.root, "blobs", assetDigest);
              const blobExists = yield* fromPromise(
                async () => Bun.file(blobPath).exists(),
                "Filesystem Asset Blob lookup failed",
              );
              if (!blobExists)
                yield* fromPromise(
                  async () => writeAtomic(blobPath, bytes, configuration.acknowledgement),
                  "Filesystem Asset Blob commit failed",
                );
              const assetId = yield* identifiers.generate("asset");
              const metadata: Metadata = {
                filename: input.filename,
                mediaType: input.mediaType,
                byteLength: bytes.byteLength,
                digest: assetDigest,
                ...(input.width === undefined ? {} : { width: input.width }),
                ...(input.height === undefined ? {} : { height: input.height }),
                ...(input.defaultAlternativeText === undefined
                  ? {}
                  : { defaultAlternativeText: input.defaultAlternativeText }),
              };
              const diskAsset: DiskAsset = { id: assetId, metadata };
              yield* SynchronizedRef.modifyEffect(state, (current) => {
                const next: State = {
                  generation: current.generation + 1,
                  records: current.records,
                  assets: new Map(current.assets).set(assetId, diskAsset),
                };
                return fromPromise(
                  async () => persistState(configuration, next),
                  "Filesystem Asset metadata commit failed",
                ).pipe(Effect.map(() => [undefined, next] as const));
              });
              return { id: assetId, metadata };
            }),
          list: SynchronizedRef.get(state).pipe(
            Effect.map((current) =>
              [...current.assets.values()].map((asset) => structuredClone(asset)),
            ),
          ),
          read: (assetId) =>
            Effect.gen(function* () {
              const current = yield* SynchronizedRef.get(state);
              const asset = current.assets.get(assetId);
              if (asset === undefined)
                return yield* Effect.fail(
                  new NotFound({ message: `Asset ${assetId} was not found` }),
                );
              const bytes = yield* fromPromise(
                async () =>
                  new Uint8Array(
                    await Bun.file(
                      join(configuration.root, "blobs", asset.metadata.digest),
                    ).arrayBuffer(),
                  ),
                "Filesystem Asset Blob read failed",
              );
              if (
                bytes.byteLength !== asset.metadata.byteLength ||
                digest(bytes) !== asset.metadata.digest
              )
                return yield* Effect.fail(
                  failure("Filesystem Asset Blob is corrupt", new Error("digest mismatch")),
                );
              return { id: asset.id, metadata: asset.metadata, bytes };
            }),
        });
      return Context.make(EntryPersistence, entryService).pipe(
        Context.add(Management, assetService),
      );
    }),
  acquire = (
    configuration: Configuration,
  ): Effect.Effect<Acquired, InfrastructureFailure, Generator> =>
    Effect.gen(function* acquire() {
      if (configuration.root.length === 0) {
        return yield* Effect.fail(
          failure("Filesystem Persistence root is required", new Error("empty root")),
        );
      }
      const identifiers = yield* Generator;
      yield* fromPromise(
        async () => mkdir(configuration.root, { recursive: true }),
        "Filesystem Persistence root creation failed",
      );
      const lockPath = join(configuration.root, "writer.lock");
      yield* fromPromise(async () => {
        const handle = await open(lockPath, "wx");
        try {
          await handle.writeFile(
            JSON.stringify({ createdAt: new Date().toISOString(), processId: process.pid }),
          );
          if (configuration.acknowledgement === "durable") {
            await handle.sync();
            await synchronize(configuration.root);
          }
        } finally {
          await handle.close();
        }
      }, "Filesystem Persistence root already has an initialized writer");
      const initialState = yield* fromPromise(
          async () => initializeRoot(configuration),
          "Filesystem Persistence initialization failed",
        ),
        context = yield* makeServices(configuration, identifiers, initialState);
      return { context, lockPath };
    });

export const layer = (
  configuration: Configuration,
): Layer.Layer<EntryPersistence | Management, InfrastructureFailure, Generator> =>
  Layer.effectContext(
    Effect.acquireRelease(acquire(configuration), (acquired) =>
      fromPromise(
        async () => rm(acquired.lockPath, { force: true }),
        "Filesystem Persistence writer lock cleanup failed",
      ).pipe(Effect.ignore),
    ).pipe(Effect.map((acquired) => acquired.context)),
  );

export const inspect = (
  root: string,
): Effect.Effect<{ readonly format: string; readonly generation: number }, InfrastructureFailure> =>
  fromPromise(async () => {
    const marker = await readJson<{ readonly format: string; readonly version: number }>(
        join(root, "format.json"),
      ),
      manifest = await readJson<DiskManifest>(join(root, "manifest.json")),
      rootStats = await stat(root);
    if (
      !rootStats.isDirectory() ||
      marker.format !== storageFormat ||
      marker.version !== storageFormatVersion
    ) {
      throw new Error("Invalid Filesystem Persistence root");
    }
    return { format: marker.format, generation: manifest.generation };
  }, "Filesystem Persistence inspection failed");
