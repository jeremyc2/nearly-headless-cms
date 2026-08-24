// oxlint-disable-next-line effecttsgo/node-builtin-import -- This Bun adapter needs durable fsync/open and directory primitives unavailable in Effect's portable FileSystem layer.
import { mkdir, open, readdir, rename, rm, stat } from "node:fs/promises";
// oxlint-disable-next-line effecttsgo/node-builtin-import -- Bun does not provide a path manipulation API; these operations are platform-neutral string handling.
import { basename, join } from "node:path";
import { Context, DateTime, Effect, Layer, Stream, SynchronizedRef } from "effect";
import { type IngestInput, Management, type Metadata } from "../../asset.ts";
import {
  type CmsError,
  Conflict,
  InfrastructureFailure,
  InvalidInput,
  NotFound,
} from "../../cms-error.ts";
import { Generator } from "../../identifier.ts";
import { type CompileOptions, type CompiledSnapshot, compile } from "../../content-definition.ts";
import {
  type CatalogState,
  DefinitionCatalog,
  type DefinitionSnapshotRecord,
  type EntryGeneration,
  EntryPersistence,
  type EntryRecord,
} from "../../persistence.ts";

const defaultAssetMaximumByteLength = 25_000_000,
  defaultEntryMaximumByteLength = 50_000_000,
  defaultMetadataMaximumByteLength = 16_384,
  emptyLength = 0,
  generationFilenameWidth = 16,
  initialGeneration = 0,
  initialVersion = 1,
  lockProbeSignal = 0,
  stagingPrefix = ".nhcms-stage-",
  storageFormat = "nearly-headless-cms/filesystem",
  storageFormatVersion = 1;

/** Root path, acknowledgement, and resource bounds for one filesystem Adapter. */
export interface Configuration {
  readonly root: string;
  readonly acknowledgement: "atomic" | "durable";
  readonly maximumEntryEncodingByteLength?: number;
  readonly maximumAssetByteLength?: number;
  readonly maximumMetadataByteLength?: number;
}

/** Filesystem configuration plus the initial Definition Snapshot. */
export interface CmsConfiguration extends Configuration {
  readonly definitionSnapshot: CompiledSnapshot;
  readonly compileOptions?: CompileOptions;
}

interface DiskAsset {
  readonly id: string;
  readonly metadata: Metadata;
}

interface DiskGeneration {
  readonly format: typeof storageFormat;
  readonly version: typeof storageFormatVersion;
  readonly generation: number;
  readonly entryGeneration?: number;
  readonly records: readonly (readonly [string, EntryRecord])[];
  readonly assets: readonly DiskAsset[];
  readonly catalog?: DiskCatalog;
}

interface DiskCatalog {
  readonly active: Omit<DefinitionSnapshotRecord, "compiled">;
  readonly events: CatalogState["events"];
  readonly migrationManifests: CatalogState["migrationManifests"];
  readonly migrationPreparations: CatalogState["migrationPreparations"];
  readonly retiredDefinitionIds: readonly string[];
  readonly revisions: CatalogState["revisions"];
  readonly snapshots: readonly Omit<DefinitionSnapshotRecord, "compiled">[];
  readonly version: number;
}

interface DiskManifest {
  readonly format: typeof storageFormat;
  readonly version: typeof storageFormatVersion;
  readonly generation: number;
  readonly generationFile: string;
  readonly generationDigest: string;
}

interface State {
  readonly catalog?: CatalogState;
  readonly entryGeneration: number;
  readonly generation: number;
  readonly records: ReadonlyMap<string, EntryRecord>;
  readonly assets: ReadonlyMap<string, DiskAsset>;
}

interface Acquired {
  readonly context: Context.Context<DefinitionCatalog | EntryPersistence | Management>;
  readonly lockPath: string;
  readonly lockToken: string;
}

interface WriterLock {
  readonly processId: number;
  readonly token?: string;
}

const failure = (message: string, cause: unknown, retryable = false): InfrastructureFailure =>
    InfrastructureFailure.make({ cause, message, retryable }),
  fromPromise = <Value>(
    operation: () => Promise<Value>,
    message: string,
  ): Effect.Effect<Value, InfrastructureFailure> =>
    Effect.tryPromise({
      catch: (cause) => failure(message, cause),
      try: operation,
    }),
  digest = (bytes: Uint8Array): string => {
    const hasher = new Bun.CryptoHasher("sha256");
    hasher.update(bytes);
    return hasher.digest("hex");
  },
  encode = (value: unknown): Uint8Array => new TextEncoder().encode(`${JSON.stringify(value)}\n`),
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
      assets: new Map([...state.assets].map(([assetId, asset]) => [assetId, structuredClone(asset)])),
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
  encodeCatalog = (catalog: CatalogState): DiskCatalog => ({
    active: { activatedAt: catalog.active.activatedAt, input: catalog.active.input },
    events: catalog.events,
    migrationManifests: catalog.migrationManifests,
    migrationPreparations: catalog.migrationPreparations,
    retiredDefinitionIds: [...catalog.retiredDefinitionIds],
    revisions: catalog.revisions,
    snapshots: catalog.snapshots.map((snapshot) => ({
      activatedAt: snapshot.activatedAt,
      input: snapshot.input,
    })),
    version: catalog.version,
  }),
  decodeCatalog = (catalog: DiskCatalog, compileOptions: CompileOptions): CatalogState => {
    const snapshots = catalog.snapshots.map((snapshot) => ({
        ...snapshot,
        compiled: compile(snapshot.input, compileOptions),
      })),
      active = snapshots.find(
        (snapshot) => snapshot.input.snapshotId === catalog.active.input.snapshotId,
      );
    if (active === undefined) {
      throw new Error("Committed Definition Catalog active Snapshot is missing");
    }
    return {
      active,
      events: structuredClone(catalog.events),
      migrationManifests: structuredClone(catalog.migrationManifests),
      migrationPreparations: structuredClone(catalog.migrationPreparations),
      retiredDefinitionIds: new Set(catalog.retiredDefinitionIds),
      revisions: structuredClone(catalog.revisions),
      snapshots,
      version: catalog.version,
    };
  },
  initialCatalog = (snapshot: CompiledSnapshot, activatedAt: string): CatalogState => {
    const snapshotRecord: DefinitionSnapshotRecord = {
      activatedAt,
      compiled: snapshot,
      input: snapshot.input,
    };
    return {
      active: snapshotRecord,
      events: [
        {
          eventType: "snapshotActivated",
          recordedAt: activatedAt,
          snapshotId: snapshot.snapshotId,
          source: "initialization",
        },
      ],
      migrationManifests: [],
      migrationPreparations: [],
      retiredDefinitionIds: new Set(),
      revisions: snapshot.input.definitions.map((definition) => ({
        definition,
        definitionId: definition.id,
        ...(definition.parentRevision === undefined
          ? {}
          : { parentRevision: definition.parentRevision }),
        revision: definition.revision ?? initialVersion,
      })),
      snapshots: [snapshotRecord],
      version: initialVersion,
    };
  },
  // oxlint-disable-next-line effecttsgo/async-function -- Bun filesystem handles expose Promise-based synchronization boundaries.
  synchronize = async (path: string): Promise<void> => {
    const handle = await open(path, "r");
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
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
  },
  filesystemErrorCode = (error: unknown): string | undefined => {
    if (typeof error !== "object" || error === null || !("code" in error)) {
      return undefined;
    }
    if (typeof error.code === "string") {
      return error.code;
    }
    return undefined;
  },
  // oxlint-disable-next-line effecttsgo/async-function -- Lock records are read through Bun's filesystem Promise API.
  readWriterLock = async (lockPath: string): Promise<WriterLock> => {
    const parsed: unknown = JSON.parse(await Bun.file(lockPath).text());
    if (typeof parsed !== "object" || parsed === null) {
      throw new Error("Writer lock is corrupt");
    }
    const processId = Reflect.get(parsed, "processId"),
      token = Reflect.get(parsed, "token");
    if (!Number.isInteger(processId) || typeof processId !== "number" || processId <= emptyLength) {
      throw new Error("Writer lock is corrupt");
    }
    if (token !== undefined && (typeof token !== "string" || token.length === emptyLength)) {
      throw new Error("Writer lock is corrupt");
    }
    if (token === undefined) {
      return { processId };
    }
    return { processId, token };
  },
  processIsActive = (processId: number): boolean => {
    try {
      process.kill(processId, lockProbeSignal);
      return true;
    } catch (error) {
      return filesystemErrorCode(error) !== "ESRCH";
    }
  },
  // oxlint-disable-next-line effecttsgo/async-function -- Lock creation requires sequential Bun filesystem operations.
  createWriterLock = async (
    configuration: Configuration,
    lockPath: string,
    lockToken: string,
  ): Promise<void> => {
    const handle = await open(lockPath, "wx");
    try {
      await handle.writeFile(
        JSON.stringify({
          createdAt: DateTime.formatIso(DateTime.nowUnsafe()),
          processId: process.pid,
          token: lockToken,
        }),
      );
      if (configuration.acknowledgement === "durable") {
        await handle.sync();
        await synchronize(configuration.root);
      }
      await handle.close();
    } catch (error) {
      await handle.close().catch(() => {});
      await rm(lockPath, { force: true }).catch(() => {});
      throw error;
    }
  },
  // oxlint-disable-next-line effecttsgo/async-function -- Recovery locking is a filesystem callback boundary.
  acquireRecoveryGuard = async (configuration: Configuration): Promise<() => Promise<void>> => {
    const guardPath = join(configuration.root, `${stagingPrefix}writer-recovery`),
      // oxlint-disable-next-line effecttsgo/crypto-random-uuid -- lock acquisition is a synchronous token-generation step around Bun file operations.
      guardToken = crypto.randomUUID(),
      // oxlint-disable-next-line effecttsgo/async-function -- Guard creation requires sequential Bun filesystem operations.
      createGuard = async (): Promise<void> => {
        const handle = await open(guardPath, "wx");
        try {
          await handle.writeFile(JSON.stringify({ processId: process.pid, token: guardToken }));
          await handle.close();
        } catch (error) {
          await handle.close().catch(() => {});
          await rm(guardPath, { force: true }).catch(() => {});
          throw error;
        }
      };
    try {
      await createGuard();
    } catch (error) {
      if (filesystemErrorCode(error) !== "EEXIST") {
        throw error;
      }
      let guardIsActive = false;
      try {
        const writerLock = await readWriterLock(guardPath);
        guardIsActive = processIsActive(writerLock.processId);
      } catch {
        guardIsActive = false;
      }
      if (guardIsActive) {
        throw new Error("Filesystem writer recovery is already in progress", { cause: error });
      }
      await rm(guardPath, { force: true });
      await createGuard();
    }
    // oxlint-disable-next-line effecttsgo/async-function -- Returned release callback closes the Bun filesystem guard.
    return async () => {
      const guard = await readWriterLock(guardPath).catch(() => {});
      if (guard?.token === guardToken) {
        await rm(guardPath, { force: true });
      }
    };
  },
  // oxlint-disable-next-line effecttsgo/async-function -- Writer recovery coordinates sequential filesystem operations.
  acquireWriterLock = async (
    configuration: Configuration,
  ): Promise<{ readonly lockPath: string; readonly lockToken: string }> => {
    const lockPath = join(configuration.root, "writer.lock"),
      // oxlint-disable-next-line effecttsgo/crypto-random-uuid -- lock acquisition is a synchronous token-generation step around Bun file operations.
      lockToken = crypto.randomUUID();
    try {
      await createWriterLock(configuration, lockPath, lockToken);
      return { lockPath, lockToken };
    } catch (error) {
      if (filesystemErrorCode(error) !== "EEXIST") {
        throw error;
      }
    }
    const releaseRecoveryGuard = await acquireRecoveryGuard(configuration);
    try {
      try {
        await createWriterLock(configuration, lockPath, lockToken);
        return { lockPath, lockToken };
      } catch (error) {
        if (filesystemErrorCode(error) !== "EEXIST") {
          throw error;
        }
      }
      const existingLock = await readWriterLock(lockPath);
      if (processIsActive(existingLock.processId)) {
        throw new Error("Filesystem Persistence root already has an initialized writer");
      }
      await rm(lockPath, { force: true });
      try {
        await createWriterLock(configuration, lockPath, lockToken);
      } catch (error) {
        if (filesystemErrorCode(error) === "EEXIST") {
          throw new Error("Filesystem Persistence root already has an initialized writer", { cause: error });
        }
        throw error;
      }
      return { lockPath, lockToken };
    } finally {
      await releaseRecoveryGuard();
    }
  },
  // oxlint-disable-next-line effecttsgo/async-function -- Lock cleanup reads and removes a Bun filesystem record.
  removeOwnedWriterLock = async (lockPath: string, lockToken: string): Promise<void> => {
    const lock = await readWriterLock(lockPath).catch(() => {});
    if (lock?.token === lockToken) {
      await rm(lockPath, { force: true });
    }
  },
  commitAssetBlob = (
    configuration: Configuration,
    content: IngestInput["content"],
  ): Effect.Effect<
    { readonly byteLength: number; readonly digest: string },
    InfrastructureFailure | InvalidInput
  > => {
    const blobsDirectory = join(configuration.root, "blobs"),
      // oxlint-disable-next-line effecttsgo/crypto-random-uuid -- staging paths are computed before the Effect stream starts and must remain synchronous.
      stagePath = join(blobsDirectory, `${stagingPrefix}blob-${crypto.randomUUID()}`),
      contentStream = (() => {
        if (content instanceof Uint8Array) {
          return Stream.make(content);
        }
        return content;
      })(),
      maximumByteLength = configuration.maximumAssetByteLength ?? defaultAssetMaximumByteLength;
    return Effect.acquireUseRelease(
      fromPromise(
        () => Promise.resolve({
          ended: false,
          writer: Bun.file(stagePath).writer({ highWaterMark: 65_536 }),
        }),
        "Filesystem Asset staging file creation failed",
      ),
      (stage) =>
        Effect.gen(function* writeAssetBlob() {
          const hasher = new Bun.CryptoHasher("sha256");
          let byteLength = emptyLength;
          yield* Stream.runForEach(
            contentStream,
            (chunk): Effect.Effect<void, InfrastructureFailure | InvalidInput> => {
              const nextByteLength = byteLength + chunk.byteLength;
              if (nextByteLength > maximumByteLength) {
                return Effect.fail(
                  InvalidInput.make({ message: "Asset bytes exceed the configured limit" }),
                );
              }
              return fromPromise(
                () =>
                  Promise.resolve().then(() => {
                    hasher.update(chunk);
                    return Promise.resolve(stage.writer.write(chunk)).then(() => {
                      byteLength = nextByteLength;
                      return stage.writer.flush();
                    });
                  }),
                "Filesystem Asset staging write failed",
              );
            },
          );
          yield* fromPromise(
            () =>
              Promise.resolve(stage.writer.end()).then(() => {
                stage.ended = true;
                return configuration.acknowledgement === "durable"
                  ? synchronize(stagePath)
                  : undefined;
              }),
            "Filesystem Asset staging finalization failed",
          );
          const assetDigest = hasher.digest("hex"),
            blobPath = join(blobsDirectory, assetDigest),
            blobExists = yield* fromPromise(
              () => Bun.file(blobPath).exists(),
              "Filesystem Asset Blob lookup failed",
            );
          if (blobExists) {
            yield* fromPromise(
              () => rm(stagePath, { force: true }),
              "Filesystem duplicate Asset staging cleanup failed",
            );
          } else {
            yield* fromPromise(
              () =>
                rename(stagePath, blobPath).then(() =>
                  configuration.acknowledgement === "durable"
                    ? synchronize(blobsDirectory)
                    : undefined,
                ),
              "Filesystem Asset Blob commit failed",
            );
          }
          return { byteLength, digest: assetDigest };
        }),
      (stage) =>
        fromPromise(
          () =>
            (stage.ended
              ? Promise.resolve()
              : Promise.resolve(stage.writer.end()).catch(() => {})
            ).then(() => rm(stagePath, { force: true }).catch(() => {})),
          "Filesystem Asset staging cleanup failed",
        ).pipe(Effect.ignore),
    );
  },
  // oxlint-disable-next-line effecttsgo/async-function -- Persistence spans ordered atomic filesystem writes.
  persistState = async (configuration: Configuration, state: State): Promise<void> => {
    const generationsDirectory = join(configuration.root, "generations"),
      generationName = `generation-${String(state.generation).padStart(generationFilenameWidth, "0")}.json`,
      generationPath = join(generationsDirectory, generationName),
      generation: DiskGeneration = {
        assets: [...state.assets.values()],
        ...(state.catalog === undefined ? {} : { catalog: encodeCatalog(state.catalog) }),
        entryGeneration: state.entryGeneration,
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
  // oxlint-disable-next-line effecttsgo/async-function -- JSON loading uses Bun's asynchronous file API.
  readJson = async <Value>(path: string): Promise<Value> => {
    const file = Bun.file(path);
    if (!(await file.exists())) {
      throw new Error(`Missing committed file ${basename(path)}`);
    }
    return (await file.json()) as Value;
  },
  // oxlint-disable-next-line effecttsgo/async-function -- Cleanup intentionally preserves sequential filesystem ordering.
  removeAbandonedStaging = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.name.startsWith(stagingPrefix)) {
        // Preserve deterministic cleanup ordering while removing abandoned staging entries.
        // oxlint-disable-next-line no-await-in-loop -- cleanup must remain sequential.
        await rm(path, { force: true, recursive: entry.isDirectory() });
      } else if (entry.isDirectory() && ["generations", "blobs"].includes(entry.name)) {
        // Preserve recursive cleanup ordering for nested staging directories.
        // oxlint-disable-next-line no-await-in-loop -- recursive cleanup must remain sequential.
        await removeAbandonedStaging(path);
      }
    }
  },
  // oxlint-disable-next-line effecttsgo/async-function -- Root initialization coordinates ordered filesystem operations.
  initializeRoot = async (
    configuration: Configuration,
    definitionSnapshot?: CompiledSnapshot,
    compileOptions: CompileOptions = {},
  ): Promise<State> => {
    await mkdir(configuration.root, { recursive: true });
    await mkdir(join(configuration.root, "generations"), { recursive: true });
    await mkdir(join(configuration.root, "blobs"), { recursive: true });
    await removeAbandonedStaging(configuration.root);
    const formatPath = join(configuration.root, "format.json"),
      manifestPath = join(configuration.root, "manifest.json"),
      formatFile = Bun.file(formatPath);
    if (!(await formatFile.exists())) {
      const rootEntries = await readdir(configuration.root),
        unexpected = rootEntries.filter(
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
      const state: State = {
        assets: new Map(),
        ...(definitionSnapshot === undefined
          ? {}
          : { catalog: initialCatalog(definitionSnapshot, DateTime.formatIso(DateTime.nowUnsafe())) }),
        entryGeneration: initialGeneration,
        generation: initialGeneration,
        records: new Map(),
      };
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
    const catalog =
      generation.catalog === undefined
        ? undefined
        : decodeCatalog(generation.catalog, compileOptions);
    if (definitionSnapshot !== undefined && catalog === undefined) {
      throw new Error("Filesystem Persistence root has no durable Definition Catalog");
    }
    if (
      definitionSnapshot !== undefined &&
      catalog?.active.compiled.definitionSpaceId !== definitionSnapshot.definitionSpaceId
    ) {
      throw new Error("Filesystem Persistence Definition Space does not match configuration");
    }
    return {
      assets: new Map(generation.assets.map((asset) => [asset.id, asset])),
      ...(catalog === undefined ? {} : { catalog }),
      entryGeneration: generation.entryGeneration ?? generation.generation,
      generation: generation.generation,
      records: new Map(generation.records),
    };
  },
  makeServices = (
    configuration: Configuration,
    identifiers: Generator["Service"],
    initialState: State,
  ): Effect.Effect<Context.Context<DefinitionCatalog | EntryPersistence | Management>> =>
    Effect.gen(function* createFilesystemServices() {
      const state = yield* SynchronizedRef.make(initialState),
        entryService = EntryPersistence.of({
          commitGeneration: (expectedGeneration, records) =>
            SynchronizedRef.modifyEffect(
              state,
              (current): Effect.Effect<readonly [EntryGeneration, State], CmsError> => {
                if (current.entryGeneration !== expectedGeneration) {
                  return Effect.fail(
                    Conflict.make({ message: "Filesystem Entry generation is stale" }),
                  );
                }
                const next: State = {
                  assets: current.assets,
                  entryGeneration: current.entryGeneration + initialVersion,
                  generation: current.generation + initialVersion,
                  records: new Map(records),
                  ...(current.catalog === undefined ? {} : { catalog: current.catalog }),
                },
                 entryEncodingByteLength = encode([...records]).byteLength;
                if (
                  entryEncodingByteLength >
                  (configuration.maximumEntryEncodingByteLength ?? defaultEntryMaximumByteLength)
                ) {
                  return Effect.fail(
                    InvalidInput.make({
                      message: "Entry generation exceeds the configured encoding limit",
                    }),
                  );
                }
                return fromPromise(
                  () => persistState(configuration, next),
                  "Filesystem Entry commit failed",
                ).pipe(
                  Effect.map(
                    () =>
                      [
                        { generation: next.entryGeneration, records: cloneState(next).records },
                        next,
                      ] as const,
                  ),
                );
              },
            ),
          readGeneration: SynchronizedRef.get(state).pipe(
            Effect.map((current) => ({
              generation: current.entryGeneration,
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
                if (!current.assets.has(assetId)) {
                  return Effect.fail(NotFound.make({ message: `Asset ${assetId} was not found` }));
                }
                const assets = new Map(current.assets);
                assets.delete(assetId);
                const next: State = {
                  assets,
                  entryGeneration: current.entryGeneration,
                  generation: current.generation + 1,
                  records: current.records,
                  ...(current.catalog === undefined ? {} : { catalog: current.catalog }),
                };
                return fromPromise(
                  () => persistState(configuration, next),
                  "Filesystem Asset deletion commit failed",
                ).pipe(Effect.map(() => [undefined, next] as const));
              },
            ),
          get: (assetId) =>
            SynchronizedRef.get(state).pipe(
              Effect.flatMap((current) => {
                const asset = current.assets.get(assetId);
                return asset === undefined
                  ? Effect.fail(NotFound.make({ message: `Asset ${assetId} was not found` }))
                  : Effect.succeed(structuredClone(asset));
              }),
            ),
          ingest: (input) =>
            Effect.gen(function*  ingest() {
              if (input.filename.trim().length === emptyLength || !input.mediaType.includes("/")) {
                return yield* InvalidInput.make({
                  message: "Asset filename and media type are required",
                });
              }
              const metadataByteLength = encode({
                defaultAlternativeText: input.defaultAlternativeText,
                filename: input.filename,
                height: input.height,
                mediaType: input.mediaType,
                width: input.width,
              }).byteLength;
              if (metadataByteLength > (configuration.maximumMetadataByteLength ?? defaultMetadataMaximumByteLength)) {
                return yield* InvalidInput.make({
                  message: "Asset metadata exceeds the configured limit",
                });
              }
              const committedBlob = yield* commitAssetBlob(configuration, input.content),
               assetId = yield* identifiers.generate("asset"),
               metadata: Metadata = {
                byteLength: committedBlob.byteLength,
                digest: committedBlob.digest,
                filename: input.filename,
                mediaType: input.mediaType,
                ...(input.width === undefined ? {} : { width: input.width }),
                ...(input.height === undefined ? {} : { height: input.height }),
                ...(input.defaultAlternativeText === undefined
                  ? {}
                  : { defaultAlternativeText: input.defaultAlternativeText }),
              },
               diskAsset: DiskAsset = { id: assetId, metadata };
              yield* SynchronizedRef.modifyEffect(state, (current) => {
                const next: State = {
                  assets: new Map(current.assets).set(assetId, diskAsset),
                  entryGeneration: current.entryGeneration,
                  generation: current.generation + 1,
                  records: current.records,
                  ...(current.catalog === undefined ? {} : { catalog: current.catalog }),
                };
                return fromPromise(
                  () => persistState(configuration, next),
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
            Effect.gen(function*  read() {
              const current = yield* SynchronizedRef.get(state),
               asset = current.assets.get(assetId);
              if (asset === undefined) {
                return yield* NotFound.make({ message: `Asset ${assetId} was not found` });
              }
              const bytes = yield* fromPromise(
                () =>
                  Bun.file(join(configuration.root, "blobs", asset.metadata.digest))
                    .arrayBuffer()
                    .then((buffer) => new Uint8Array(buffer)),
                "Filesystem Asset Blob read failed",
              );
              if (
                bytes.byteLength !== asset.metadata.byteLength ||
                digest(bytes) !== asset.metadata.digest
              ) {
                return yield* failure(
                  "Filesystem Asset Blob is corrupt",
                  new Error("digest mismatch"),
                );
              }
              return { bytes, id: asset.id, metadata: asset.metadata };
            }),
        }),
        missingCatalog = (): InfrastructureFailure =>
          failure("Filesystem Definition Catalog is not configured", new Error("missing catalog")),
        catalogService = DefinitionCatalog.of({
          commitCutover: ({
            catalogState,
            entryRecords,
            expectedCatalogVersion,
            expectedEntryGeneration,
          }) =>
            SynchronizedRef.modifyEffect(
              state,
              (
                current,
              ): Effect.Effect<
                readonly [
                  {
                    readonly catalog: CatalogState;
                    readonly entries: EntryGeneration;
                  },
                  State,
                ],
                CmsError
              > => {
                if (current.catalog === undefined) {
                  return Effect.fail(missingCatalog());
                }
                if (current.catalog.version !== expectedCatalogVersion) {
                  return Effect.fail(
                    Conflict.make({ message: "Definition Catalog version is stale" }),
                  );
                }
                if (current.entryGeneration !== expectedEntryGeneration) {
                  return Effect.fail(
                    Conflict.make({ message: "Filesystem Entry generation is stale" }),
                  );
                }
                const catalog = {
                    ...cloneCatalog(catalogState),
                    version: expectedCatalogVersion + 1,
                  },
                  next: State = {
                    assets: current.assets,
                    catalog,
                    entryGeneration: current.entryGeneration + 1,
                    generation: current.generation + 1,
                    records: new Map(entryRecords),
                  };
                return fromPromise(
                  () => persistState(configuration, next),
                  "Atomic Definition Cutover commit failed",
                ).pipe(
                  Effect.map(
                    () =>
                      [
                        {
                          catalog: cloneCatalog(catalog),
                          entries: {
                            generation: next.entryGeneration,
                            records: cloneState(next).records,
                          },
                        },
                        next,
                      ] as const,
                  ),
                );
              },
            ),
          read: SynchronizedRef.get(state).pipe(
            Effect.flatMap((current) =>
              current.catalog === undefined
                ? Effect.fail(missingCatalog())
                : Effect.succeed(cloneCatalog(current.catalog)),
            ),
          ),
          replace: (expectedVersion, replacement) =>
            SynchronizedRef.modifyEffect(
              state,
              (current): Effect.Effect<readonly [CatalogState, State], CmsError> => {
                if (current.catalog === undefined) {
                  return Effect.fail(missingCatalog());
                }
                if (current.catalog.version !== expectedVersion) {
                  return Effect.fail(
                    Conflict.make({ message: "Definition Catalog version is stale" }),
                  );
                }
                const catalog = { ...cloneCatalog(replacement), version: expectedVersion + 1 },
                  next: State = {
                    ...current,
                    catalog,
                    generation: current.generation + 1,
                  };
                return fromPromise(
                  () => persistState(configuration, next),
                  "Filesystem Definition Catalog commit failed",
                ).pipe(Effect.map(() => [cloneCatalog(catalog), next] as const));
              },
            ),
        });
      return Context.make(EntryPersistence, entryService).pipe(
        Context.add(Management, assetService),
        Context.add(DefinitionCatalog, catalogService),
      );
    }),
  acquire = (
    configuration: Configuration,
    definitionSnapshot?: CompiledSnapshot,
    compileOptions: CompileOptions = {},
  ): Effect.Effect<Acquired, InfrastructureFailure, Generator> =>
    Effect.gen(function* acquireFilesystemRoot() {
      if (configuration.root.length === 0) {
        return yield* failure("Filesystem Persistence root is required", new Error("empty root"));
      }
      const identifiers = yield* Generator;
      yield* fromPromise(
        () => mkdir(configuration.root, { recursive: true }),
        "Filesystem Persistence root creation failed",
      );
      const acquiredLock = yield* fromPromise(
        () => acquireWriterLock(configuration),
        "Filesystem Persistence root already has an initialized writer",
      );
      return yield* Effect.gen(function* initializeFilesystemRoot() {
        const initialState = yield* fromPromise(
            () => initializeRoot(configuration, definitionSnapshot, compileOptions),
            "Filesystem Persistence initialization failed",
          ),
          context = yield* makeServices(configuration, identifiers, initialState);
        return { context, ...acquiredLock };
      }).pipe(
        Effect.onError(() =>
          fromPromise(
            () => removeOwnedWriterLock(acquiredLock.lockPath, acquiredLock.lockToken),
            "Filesystem Persistence writer lock cleanup failed",
          ).pipe(Effect.ignore),
        ),
      );
    });

/**
 * Creates Bun-only Entry, Asset, and Definition persistence services for one root.
 * Exactly one writer process may own a root; startup recovers staged generations.
 */
export const layer = (
  configuration: Configuration,
): Layer.Layer<EntryPersistence | Management, InfrastructureFailure, Generator> =>
  Layer.effectContext(
    Effect.acquireRelease(acquire(configuration), (acquired) =>
      fromPromise(
        () => removeOwnedWriterLock(acquired.lockPath, acquired.lockToken),
        "Filesystem Persistence writer lock cleanup failed",
      ).pipe(Effect.ignore),
    ).pipe(Effect.map((acquired) => acquired.context)),
  );

/** Creates the complete filesystem persistence Layer used by a CMS composition. */
export const cmsLayer = (
  configuration: CmsConfiguration,
): Layer.Layer<
  DefinitionCatalog | EntryPersistence | Management,
  InfrastructureFailure,
  Generator
> =>
  Layer.effectContext(
    Effect.acquireRelease(
      acquire(configuration, configuration.definitionSnapshot, configuration.compileOptions ?? {}),
      (acquired) =>
        fromPromise(
          () => removeOwnedWriterLock(acquired.lockPath, acquired.lockToken),
          "Filesystem Persistence writer lock cleanup failed",
        ).pipe(Effect.ignore),
    ).pipe(Effect.map((acquired) => acquired.context)),
  );

/** Reads a bounded diagnostic snapshot of a filesystem root without mutating it. */
export const inspect = (
  root: string,
): Effect.Effect<{ readonly format: string; readonly generation: number }, InfrastructureFailure> =>
  // oxlint-disable-next-line effecttsgo/async-function -- Diagnostic inspection is a read-only filesystem boundary.
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
