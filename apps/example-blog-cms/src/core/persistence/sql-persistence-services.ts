import type { Identifier} from "nearly-headless-cms";
import { Asset, CmsError, Persistence } from "nearly-headless-cms";
import type { ContentDefinition } from "nearly-headless-cms";
import { Context, Effect, Schema, SynchronizedRef } from "effect";
import type { LocalAssetBlobStore } from "../assets/local-asset-blob-store.ts";
import { buildAssetMetadata } from "../assets/s3-asset-blob-store-reference.ts";
import {
  defaultEntryMaximumByteLength,
  initialVersion,
} from "./sql-persistence-constants.ts";
import type { SqlDatabaseClient } from "./sql-database-connection.ts";
import { loadPersistenceState, persistPersistenceState } from "./sql-persistence-repository.ts";
import {
  cloneCatalog,
  clonePersistenceState,
  emptyPersistenceState,
  type DiskAsset,
  type PersistenceState,
} from "./sql-persistence-state.ts";

export interface SqlPersistenceConfiguration {
  readonly database: SqlDatabaseClient;
  readonly definitionSnapshot: ContentDefinition.CompiledSnapshot;
  readonly blobStore: LocalAssetBlobStore;
  readonly maximumEntryEncodingByteLength?: number;
}

const optionalCatalog = (
  catalog: Persistence.CatalogState | undefined,
): { readonly catalog?: Persistence.CatalogState } => {
  if (catalog === undefined) {
    return {};
  }
  return { catalog };
};

const fromPromise = <Success>(
  run: () => Promise<Success>,
  message: string,
): Effect.Effect<Success, CmsError.InfrastructureFailure> =>
  Effect.tryPromise({
    catch: (cause) =>
      CmsError.InfrastructureFailure.make({
        cause,
        message,
        retryable: true,
      }),
    try: run,
  });

const mapPersistenceError = <Success>(
  operation: Effect.Effect<Success, Error | CmsError.InfrastructureFailure>,
): Effect.Effect<Success, CmsError.CmsError | CmsError.InfrastructureFailure> =>
  operation.pipe(
    Effect.mapError((error) => {
      if (Schema.is(CmsError.InfrastructureFailure)(error)) {
        return error;
      }
      if (error instanceof Error && error.message.includes("stale")) {
        return CmsError.Conflict.make({ message: error.message });
      }
      return CmsError.InfrastructureFailure.make({
        cause: error,
        message: error instanceof Error ? error.message : "SQL persistence failed",
        retryable: true,
      });
    }),
  );

const persistTuple = <Tuple extends readonly [unknown, PersistenceState]>(input: {
  readonly configuration: SqlPersistenceConfiguration;
  readonly expectedEntryGeneration: number;
  readonly message: string;
  readonly next: PersistenceState;
  readonly tuple: Tuple;
}): Effect.Effect<Tuple, CmsError.CmsError | CmsError.InfrastructureFailure> =>
  mapPersistenceError(
    fromPromise(
      () =>
        persistPersistenceState(
          input.configuration.database,
          input.expectedEntryGeneration,
          input.next,
        ),
      input.message,
    ).pipe(Effect.map(() => input.tuple)),
  );

const missingCatalog = (): Effect.Effect<never, CmsError.InfrastructureFailure> =>
  CmsError.InfrastructureFailure.make({
    message: "SQL Definition Catalog is not configured",
    retryable: false,
  });

const buildEntryService = (
  configuration: SqlPersistenceConfiguration,
  state: SynchronizedRef.SynchronizedRef<PersistenceState>,
) =>
  Persistence.EntryPersistence.of({
    commitGeneration: (expectedGeneration, records) =>
      SynchronizedRef.modifyEffect(state, commitEntryRecords(configuration, expectedGeneration, records)),
    readGeneration: (_void: void) =>
      SynchronizedRef.get(state).pipe(
        Effect.map((current) => ({
          generation: current.entryGeneration,
          records: clonePersistenceState(current).records,
        })),
      ),
  });

const commitEntryRecords =
  (
    configuration: SqlPersistenceConfiguration,
    expectedGeneration: number,
    records: ReadonlyMap<string, Persistence.EntryRecord>,
  ) =>
  (current: PersistenceState): Effect.Effect<
    readonly [Persistence.EntryGeneration, PersistenceState],
    CmsError.CmsError | CmsError.InfrastructureFailure
  > => {
    if (current.entryGeneration !== expectedGeneration) {
      return CmsError.Conflict.make({ message: "SQL Entry generation is stale" });
    }
    const entryEncodingByteLength = new TextEncoder().encode(JSON.stringify([...records])).byteLength,
      next: PersistenceState = {
        assets: current.assets,
        entryGeneration: current.entryGeneration + initialVersion,
        generation: current.generation + initialVersion,
        records: new Map(records),
        ...optionalCatalog(current.catalog),
      };
    if (
      entryEncodingByteLength >
      (configuration.maximumEntryEncodingByteLength ?? defaultEntryMaximumByteLength)
    ) {
      return CmsError.InvalidInput.make({
        message: "Entry generation exceeds the configured encoding limit",
      });
    }
    return persistTuple({
      configuration,
      expectedEntryGeneration: expectedGeneration,
      message: "SQL Entry commit failed",
      next,
      tuple: [
        { generation: next.entryGeneration, records: clonePersistenceState(next).records },
        next,
      ] as const,
    });
  };

const buildCatalogService = (
  configuration: SqlPersistenceConfiguration,
  state: SynchronizedRef.SynchronizedRef<PersistenceState>,
) =>
  Persistence.DefinitionCatalog.of({
    commitCutover: (input) =>
      SynchronizedRef.modifyEffect(state, (current) => commitCatalogCutover(configuration, current, input)),
    read: (_void: void) =>
      SynchronizedRef.get(state).pipe(
        Effect.flatMap((current) => {
          if (current.catalog === undefined) {
            return missingCatalog();
          }
          return Effect.succeed(cloneCatalog(current.catalog));
        }),
      ),
    replace: (expectedVersion, replacement) =>
      SynchronizedRef.modifyEffect(state, replaceCatalog(configuration, expectedVersion, replacement)),
  });

const commitCatalogCutover = (
  configuration: SqlPersistenceConfiguration,
  current: PersistenceState,
  input: Persistence.CommitCutoverInput,
): Effect.Effect<
  readonly [
    { readonly catalog: Persistence.CatalogState; readonly entries: Persistence.EntryGeneration },
    PersistenceState,
  ],
  CmsError.CmsError | CmsError.InfrastructureFailure
> => {
  if (current.catalog === undefined) {
    return missingCatalog();
  }
  if (current.catalog.version !== input.expectedCatalogVersion) {
    return CmsError.Conflict.make({ message: "Definition Catalog version is stale" });
  }
  if (current.entryGeneration !== input.expectedEntryGeneration) {
    return CmsError.Conflict.make({ message: "SQL Entry generation is stale" });
  }
  const catalog = {
      ...cloneCatalog(input.catalogState),
      version: input.expectedCatalogVersion + 1,
    },
    next: PersistenceState = {
      assets: current.assets,
      catalog,
      entryGeneration: current.entryGeneration + 1,
      generation: current.generation + 1,
      records: new Map(input.entryRecords),
    };
  return persistTuple({
    configuration,
    expectedEntryGeneration: input.expectedEntryGeneration,
    message: "Atomic Definition Cutover commit failed",
    next,
    tuple: [
      {
        catalog: cloneCatalog(catalog),
        entries: { generation: next.entryGeneration, records: clonePersistenceState(next).records },
      },
      next,
    ] as const,
  });
};

const replaceCatalog =
  (configuration: SqlPersistenceConfiguration, expectedVersion: number, replacement: Persistence.CatalogState) =>
  (current: PersistenceState): Effect.Effect<
    readonly [Persistence.CatalogState, PersistenceState],
    CmsError.CmsError | CmsError.InfrastructureFailure
  > => {
    if (current.catalog === undefined) {
      return missingCatalog();
    }
    if (current.catalog.version !== expectedVersion) {
      return CmsError.Conflict.make({ message: "Definition Catalog version is stale" });
    }
    const catalog = { ...cloneCatalog(replacement), version: expectedVersion + 1 },
      next: PersistenceState = { ...current, catalog, generation: current.generation + 1 };
    return persistTuple({
      configuration,
      expectedEntryGeneration: current.entryGeneration,
      message: "SQL Definition Catalog commit failed",
      next,
      tuple: [cloneCatalog(catalog), next] as const,
    });
  };

const buildAssetService = (
  configuration: SqlPersistenceConfiguration,
  identifiers: Identifier.Generator["Service"],
  state: SynchronizedRef.SynchronizedRef<PersistenceState>,
) =>
  Asset.Management.of({
    delete: (assetId) =>
      SynchronizedRef.modifyEffect(state, (current) => deleteAsset(configuration, current, assetId)).pipe(
        Effect.mapError((error) => {
          if (Schema.is(CmsError.NotFound)(error)) {
            return error;
          }
          return CmsError.InfrastructureFailure.make({
            cause: error,
            message: error.message,
            retryable: Schema.is(CmsError.Conflict)(error),
          });
        }),
      ),
    get: (assetId) =>
      SynchronizedRef.get(state).pipe(
        Effect.flatMap((current) => {
          const asset = current.assets.get(assetId);
          if (asset === undefined) {
            return CmsError.NotFound.make({ message: `Asset ${assetId} was not found` });
          }
          return Effect.succeed(structuredClone(asset));
        }),
      ),
    ingest: (input) =>
      ingestAsset({ blobStore: configuration.blobStore, configuration, identifiers, input, state }).pipe(
        Effect.mapError((error) => {
          if (Schema.is(CmsError.InvalidInput)(error)) {
            return error;
          }
          if (Schema.is(CmsError.InfrastructureFailure)(error)) {
            return error;
          }
          return CmsError.InfrastructureFailure.make({
            cause: error,
            message: error.message,
            retryable: Schema.is(CmsError.Conflict)(error),
          });
        }),
      ),
    list: (_void: void) =>
      SynchronizedRef.get(state).pipe(
        Effect.map((current) =>
          [...current.assets.values()].map((asset) => structuredClone(asset)),
        ),
      ),
    read: (assetId) =>
      SynchronizedRef.get(state).pipe(
        Effect.flatMap((current) => {
          const asset = current.assets.get(assetId);
          if (asset === undefined) {
            return CmsError.NotFound.make({ message: `Asset ${assetId} was not found` });
          }
          return Effect.succeed({
            ...structuredClone(asset),
            content: configuration.blobStore.readBlobStream(
              asset.metadata.digest,
              asset.metadata.byteLength,
            ),
          });
        }),
      ),
  });

const ingestAsset = (request: {
  readonly blobStore: LocalAssetBlobStore;
  readonly configuration: SqlPersistenceConfiguration;
  readonly identifiers: Identifier.Generator["Service"];
  readonly input: Asset.IngestInput;
  readonly state: SynchronizedRef.SynchronizedRef<PersistenceState>;
}) =>
  Effect.gen(function* ingestAssetEffect() {
    yield* request.blobStore.validateIngestInput(request.input);
    const assetId = yield* request.identifiers.generate("asset"),
      committedBlob = yield* request.blobStore.commitBlob(request.input.content),
      diskAsset: DiskAsset = {
        id: assetId,
        metadata: buildAssetMetadata(request.input, committedBlob),
      };
    yield* SynchronizedRef.modifyEffect(request.state, (current) => {
      const next: PersistenceState = {
        assets: new Map(current.assets).set(assetId, diskAsset),
        entryGeneration: current.entryGeneration,
        generation: current.generation + 1,
        records: current.records,
        ...optionalCatalog(current.catalog),
      };
      return persistTuple({
        configuration: request.configuration,
        expectedEntryGeneration: current.entryGeneration,
        message: "SQL Asset metadata commit failed",
        next,
        tuple: [undefined, next] as const,
      });
    });
    return { id: assetId, metadata: diskAsset.metadata };
  });

const deleteAsset = (
  configuration: SqlPersistenceConfiguration,
  current: PersistenceState,
  assetId: string,
): Effect.Effect<
  readonly [undefined, PersistenceState],
  CmsError.CmsError | CmsError.InfrastructureFailure
> => {
  if (!current.assets.has(assetId)) {
    return CmsError.NotFound.make({ message: `Asset ${assetId} was not found` });
  }
  const next: PersistenceState = {
    assets: new Map([...current.assets].filter(([identifier]) => identifier !== assetId)),
    entryGeneration: current.entryGeneration,
    generation: current.generation + 1,
    records: current.records,
    ...optionalCatalog(current.catalog),
  };
  return persistTuple({
    configuration,
    expectedEntryGeneration: current.entryGeneration,
    message: "SQL Asset deletion commit failed",
    next,
    tuple: [undefined, next] as const,
  });
};

// oxlint-disable-next-line effecttsgo/missing-pipeable-signature -- [EH-328] SQL persistence services are assembled once during layer acquisition.
export const makeSqlPersistenceServices = (
  configuration: SqlPersistenceConfiguration,
  identifiers: Identifier.Generator["Service"],
  initialState: PersistenceState,
): Effect.Effect<
  Context.Context<Persistence.DefinitionCatalog | Persistence.EntryPersistence | Asset.Management>
> =>
  Effect.gen(function* createSqlPersistenceServices() {
    const state = yield* SynchronizedRef.make(initialState);
    return Context.make(Persistence.EntryPersistence, buildEntryService(configuration, state)).pipe(
      Context.add(Asset.Management, buildAssetService(configuration, identifiers, state)),
      Context.add(Persistence.DefinitionCatalog, buildCatalogService(configuration, state)),
    );
  });

// oxlint-disable-next-line effecttsgo/async-function -- [EH-321] SQL persistence initialization uses Kysely's promise API directly.
export const initializePersistenceState = async (
  configuration: SqlPersistenceConfiguration,
): Promise<PersistenceState> => {
  const existing = await loadPersistenceState(configuration.database);
  if (existing !== undefined) {
    return existing;
  }
  const initialState = emptyPersistenceState(configuration.definitionSnapshot);
  await persistPersistenceState(configuration.database, 0, initialState);
  return initialState;
};
