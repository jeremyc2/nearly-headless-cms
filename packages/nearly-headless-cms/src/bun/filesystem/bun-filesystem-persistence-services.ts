import {
  type CatalogState,
  type CmsError,
  type Configuration,
  Conflict,
  Context,
  type DefinitionCatalog,
  DefinitionCatalogTag,
  type DiskAsset,
  Effect,
  type EntryGeneration,
  type EntryPersistence,
  EntryPersistenceTag,
  type EntryRecord,
  type Generator,
  InvalidInput,
  Management,
  NotFound,
  type State,
  SynchronizedRef,
  initialVersion,
} from "./bun-filesystem-persistence-services-imports.ts";
import filesystemIngestSupport from "./bun-filesystem-persistence-ingest-support.ts";
import filesystemLockRoot from "./bun-filesystem-persistence-lock-root.ts";
import filesystemReadSupport from "./bun-filesystem-persistence-read-support.ts";
import filesystemSupport from "./bun-filesystem-persistence-support.ts";
const { persistState } = filesystemLockRoot,
  { buildAssetMetadata, validateIngestInput } = filesystemIngestSupport,
  { readAsset } = filesystemReadSupport,
  {
    cloneCatalog,
    cloneState,
    commitAssetBlob,
    defaultEntryMaximumByteLength,
    encode,
    failure,
    fromPromise,
  } = filesystemSupport,
  buildAssetService = <Ref extends SynchronizedRef.SynchronizedRef<State>>(
    configuration: Readonly<Configuration>,
    identifiers: Generator["Service"],
    state: Readonly<Ref>,
  ) =>
    Management.of({
      delete: (assetId) => deleteAsset(configuration, state, assetId),
      get: (assetId) =>
        SynchronizedRef.get(state).pipe(
          Effect.flatMap((current) => {
            const asset = current.assets.get(assetId);
            if (asset === undefined) {
              return Effect.fail(NotFound.make({ message: `Asset ${assetId} was not found` }));
            }
            return Effect.succeed(structuredClone(asset));
          }),
        ),
      ingest: (input) => ingestAsset({ configuration, identifiers, input, state }),
      list: (_void: void) =>
        SynchronizedRef.get(state).pipe(
          Effect.map((current) =>
            [...current.assets.values()].map((asset) => structuredClone(asset)),
          ),
        ),
      read: (assetId) => readAsset(configuration, state, assetId),
    }),
  buildCatalogService = <Ref extends SynchronizedRef.SynchronizedRef<State>>(
    configuration: Readonly<Configuration>,
    state: Readonly<Ref>,
  ) =>
    DefinitionCatalogTag.of({
      commitCutover: (input) =>
        SynchronizedRef.modifyEffect(state, (current) =>
          commitCatalogCutover(configuration, current, input),
        ),
      read: (_void: void) =>
        SynchronizedRef.get(state).pipe(
          Effect.flatMap((current) => {
            if (current.catalog === undefined) {
              return Effect.fail(missingCatalog());
            }
            return Effect.succeed(cloneCatalog(current.catalog));
          }),
        ),
      replace: (expectedVersion, replacement) =>
        SynchronizedRef.modifyEffect(
          state,
          replaceCatalog(configuration, expectedVersion, replacement),
        ),
    }),
  buildEntryService = <Ref extends SynchronizedRef.SynchronizedRef<State>>(
    configuration: Readonly<Configuration>,
    state: Readonly<Ref>,
  ) =>
    EntryPersistenceTag.of({
      commitGeneration: (expectedGeneration, records) =>
        SynchronizedRef.modifyEffect(
          state,
          commitEntryRecords(configuration, expectedGeneration, records),
        ),
      readGeneration: (_void: void) =>
        SynchronizedRef.get(state).pipe(
          Effect.map((current) => ({
            generation: current.entryGeneration,
            records: cloneState(current).records,
          })),
        ),
    }),
  commitCatalogCutover = (
    configuration: Configuration,
    current: State,
    input: {
      readonly catalogState: CatalogState;
      readonly entryRecords: ReadonlyMap<string, EntryRecord>;
      readonly expectedCatalogVersion: number;
      readonly expectedEntryGeneration: number;
    },
  ): Effect.Effect<
    readonly [{ readonly catalog: CatalogState; readonly entries: EntryGeneration }, State],
    CmsError
  > => {
    if (current.catalog === undefined) {
      return Effect.fail(missingCatalog());
    }
    if (current.catalog.version !== input.expectedCatalogVersion) {
      return Effect.fail(Conflict.make({ message: "Definition Catalog version is stale" }));
    }
    if (current.entryGeneration !== input.expectedEntryGeneration) {
      return Effect.fail(Conflict.make({ message: "Filesystem Entry generation is stale" }));
    }
    const catalog = {
        ...cloneCatalog(input.catalogState),
        version: input.expectedCatalogVersion + 1,
      },
      next: State = {
        assets: current.assets,
        catalog,
        entryGeneration: current.entryGeneration + 1,
        generation: current.generation + 1,
        records: new Map(input.entryRecords),
      };
    return persistTuple({
      configuration,
      message: "Atomic Definition Cutover commit failed",
      next,
      tuple: [
        {
          catalog: cloneCatalog(catalog),
          entries: { generation: next.entryGeneration, records: cloneState(next).records },
        },
        next,
      ] as const,
    });
  },
  commitEntryRecords =
    (
      configuration: Configuration,
      expectedGeneration: number,
      records: ReadonlyMap<string, EntryRecord>,
    ) =>
    (current: State): Effect.Effect<readonly [EntryGeneration, State], CmsError> => {
      if (current.entryGeneration !== expectedGeneration) {
        return Effect.fail(Conflict.make({ message: "Filesystem Entry generation is stale" }));
      }
      const entryEncodingByteLength = encode([...records]).byteLength,
        next: State = {
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
        return Effect.fail(
          InvalidInput.make({ message: "Entry generation exceeds the configured encoding limit" }),
        );
      }
      return persistTuple({
        configuration,
        message: "Filesystem Entry commit failed",
        next,
        tuple: [
          { generation: next.entryGeneration, records: cloneState(next).records },
          next,
        ] as const,
      });
    },
  deleteAsset = <Ref extends SynchronizedRef.SynchronizedRef<State>>(
    configuration: Readonly<Configuration>,
    state: Readonly<Ref>,
    assetId: string,
  ) =>
    SynchronizedRef.modifyEffect(
      state,
      (
        current,
      ): Effect.Effect<readonly [undefined, State], NotFound | ReturnType<typeof failure>> => {
        if (!current.assets.has(assetId)) {
          return Effect.fail(NotFound.make({ message: `Asset ${assetId} was not found` }));
        }
        const next: State = {
          assets: new Map([...current.assets].filter(([id]) => id !== assetId)),
          entryGeneration: current.entryGeneration,
          generation: current.generation + 1,
          records: current.records,
          ...optionalCatalog(current.catalog),
        };
        return persistTuple({
          configuration,
          message: "Filesystem Asset deletion commit failed",
          next,
          tuple: [undefined, next] as const,
        });
      },
    ),
  ingestAsset = (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-207] SynchronizedRef state is mutated while persisting ingested assets.
    request: {
    readonly configuration: Configuration;
    readonly identifiers: Generator["Service"];
    readonly input: Parameters<Management["Service"]["ingest"]>[0];
    readonly state: SynchronizedRef.SynchronizedRef<State>;
  }) =>
    Effect.gen(function* ingestAssetMetadata() {
      yield* validateIngestInput(request.configuration, request.input);
      const assetId = yield* request.identifiers.generate("asset"),
        committedBlob = yield* commitAssetBlob(request.configuration, request.input.content),
        diskAsset: DiskAsset = {
          id: assetId,
          metadata: buildAssetMetadata(request.input, committedBlob),
        };
      yield* SynchronizedRef.modifyEffect(request.state, (current) => {
        const next: State = {
          assets: new Map(current.assets).set(assetId, diskAsset),
          entryGeneration: current.entryGeneration,
          generation: current.generation + 1,
          records: current.records,
          ...optionalCatalog(current.catalog),
        };
        return persistTuple({
          configuration: request.configuration,
          message: "Filesystem Asset metadata commit failed",
          next,
          tuple: [undefined, next] as const,
        });
      });
      return { id: assetId, metadata: diskAsset.metadata };
    }),
  makeServices = (
    configuration: Configuration,
    identifiers: Generator["Service"],
    initialState: State,
  ): Effect.Effect<Context.Context<DefinitionCatalog | EntryPersistence | Management>> =>
    Effect.gen(function* createFilesystemServices() {
      const state = yield* SynchronizedRef.make(initialState);
      return Context.make(EntryPersistenceTag, buildEntryService(configuration, state)).pipe(
        Context.add(Management, buildAssetService(configuration, identifiers, state)),
        Context.add(DefinitionCatalogTag, buildCatalogService(configuration, state)),
      );
    }),
  missingCatalog = (): ReturnType<typeof failure> =>
    failure("Filesystem Definition Catalog is not configured", new Error("missing catalog")),
  optionalCatalog = (catalog: CatalogState | undefined): { readonly catalog?: CatalogState } => {
    if (catalog === undefined) {
      return {};
    }
    return { catalog };
  },
  persistTuple = <Tuple extends readonly [unknown, State]>(input: {
    readonly configuration: Configuration;
    readonly message: string;
    readonly next: State;
    readonly tuple: Tuple;
  }) =>
    fromPromise(() => persistState(input.configuration, input.next), input.message).pipe(
      Effect.map(() => input.tuple),
    ),
  replaceCatalog =
    (configuration: Configuration, expectedVersion: number, replacement: CatalogState) =>
    (current: State): Effect.Effect<readonly [CatalogState, State], CmsError> => {
      if (current.catalog === undefined) {
        return Effect.fail(missingCatalog());
      }
      if (current.catalog.version !== expectedVersion) {
        return Effect.fail(Conflict.make({ message: "Definition Catalog version is stale" }));
      }
      const catalog = { ...cloneCatalog(replacement), version: expectedVersion + 1 },
        next: State = { ...current, catalog, generation: current.generation + 1 };
      return persistTuple({
        configuration,
        message: "Filesystem Definition Catalog commit failed",
        next,
        tuple: [cloneCatalog(catalog), next] as const,
      });
    };

export default { makeServices };
