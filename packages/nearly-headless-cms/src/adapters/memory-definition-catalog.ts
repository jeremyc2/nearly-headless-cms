import {
  type CatalogState,
  DefinitionCatalog,
  type DefinitionRevisionRecord,
  type DefinitionSnapshotRecord,
  EntryPersistence,
} from "../persistence.ts";
import { DateTime, Effect, Layer, SynchronizedRef } from "effect";
import type { CompiledSnapshot } from "../content-definition.ts";
import { Conflict } from "../cms-error.ts";

/** Initial snapshot and optional catalog records for the in-memory Adapter. */
export interface Options {
  readonly snapshot: CompiledSnapshot;
}

interface InitialCatalogStateInput {
  readonly activatedAt: string;
  readonly snapshot: CompiledSnapshot;
}

const catalogCloneState = (state: Readonly<CatalogState>): CatalogState => ({
    ...state,
    active: state.active,
    events: [...state.events],
    migrationManifests: structuredClone(state.migrationManifests),
    migrationPreparations: structuredClone(state.migrationPreparations),
    retiredDefinitionIds: new Set(state.retiredDefinitionIds),
    revisions: [...state.revisions],
    snapshots: [...state.snapshots],
  }),
  catalogIncrementVersion = 1,
  catalogInitialVersion = 1,
  catalogMakeDefinitionRevisionRecord = (
    definition: CompiledSnapshot["input"]["definitions"][number],
  ): DefinitionRevisionRecord => {
    const record: DefinitionRevisionRecord = {
      definition,
      definitionId: definition.id,
      revision: definition.revision ?? catalogInitialVersion,
    };
    if (definition.parentRevision === undefined) {
      return record;
    }
    return { ...record, parentRevision: definition.parentRevision };
  },
  catalogMakeInitialState = ({
    activatedAt,
    snapshot,
  }: Readonly<InitialCatalogStateInput>): CatalogState => {
    const initialSnapshot: DefinitionSnapshotRecord = {
      activatedAt,
      compiled: snapshot,
      input: snapshot.input,
    };
    return {
      active: initialSnapshot,
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
      revisions: snapshot.input.definitions.map(catalogMakeDefinitionRevisionRecord),
      snapshots: [initialSnapshot],
      version: catalogInitialVersion,
    };
  },
  catalogMakeService = <Ref extends SynchronizedRef.SynchronizedRef<CatalogState>>(
    entryPersistence: typeof EntryPersistence.Service,
    state: Readonly<Ref>,
  ): typeof DefinitionCatalog.Service =>
    DefinitionCatalog.of({
      commitCutover: ({
        catalogState,
        entryRecords,
        expectedCatalogVersion,
        expectedEntryGeneration,
      }) =>
        SynchronizedRef.modifyEffect(state, (current) => {
          if (current.version !== expectedCatalogVersion) {
            return Effect.fail(Conflict.make({ message: "Definition Catalog version is stale" }));
          }
          const committed = {
            ...catalogCloneState(catalogState),
            version: expectedCatalogVersion + catalogIncrementVersion,
          };
          return entryPersistence
            .commitGeneration(expectedEntryGeneration, entryRecords)
            .pipe(
              Effect.map(
                (entries) =>
                  [{ catalog: catalogCloneState(committed), entries }, committed] as const,
              ),
            );
        }),
      read: (_void: void) => SynchronizedRef.get(state).pipe(Effect.map(catalogCloneState)),
      replace: (expectedVersion, replacement) =>
        SynchronizedRef.modifyEffect(state, (current) => {
          if (current.version !== expectedVersion) {
            return Effect.fail(Conflict.make({ message: "Definition Catalog version is stale" }));
          }
          const committed = {
            ...catalogCloneState(replacement),
            version: expectedVersion + catalogIncrementVersion,
          };
          return Effect.succeed([catalogCloneState(committed), committed] as const);
        }),
    }),
  catalogZLayer = ({
    snapshot,
  }: Options): Layer.Layer<DefinitionCatalog, never, EntryPersistence> =>
    Layer.effect(
      DefinitionCatalog,
      Effect.gen(function* makeMemoryDefinitionCatalog() {
        const activatedAt = DateTime.formatIso(yield* DateTime.now),
          entryPersistence = yield* EntryPersistence,
          initialState = catalogMakeInitialState({ activatedAt, snapshot }),
          state = yield* SynchronizedRef.make(initialState);
        return catalogMakeService(entryPersistence, state);
      }),
    );

/** Creates a process-local Definition Catalog with atomic cutover semantics. */
export { catalogZLayer as layer };
