import { Clock, Effect, Layer, SynchronizedRef } from "effect";
import type { CompiledSnapshot } from "../content-definition.ts";
import { Conflict } from "../cms-error.ts";
import {
  type CatalogState,
  DefinitionCatalog,
  type DefinitionSnapshotRecord,
  EntryPersistence,
} from "../persistence.ts";

/** Initial snapshot and optional catalog records for the in-memory Adapter. */
export interface Options {
  readonly snapshot: CompiledSnapshot;
}

const cloneState = (state: CatalogState): CatalogState => ({
  ...state,
  active: state.active,
  events: [...state.events],
  migrationManifests: structuredClone(state.migrationManifests),
  migrationPreparations: structuredClone(state.migrationPreparations),
  retiredDefinitionIds: new Set(state.retiredDefinitionIds),
  revisions: [...state.revisions],
  snapshots: [...state.snapshots],
});

/** Creates a process-local Definition Catalog with atomic cutover semantics. */
export const layer = ({
  snapshot,
}: Options): Layer.Layer<DefinitionCatalog, never, EntryPersistence> =>
  Layer.effect(
    DefinitionCatalog,
    Effect.gen(function* layer() {
      const entryPersistence = yield* EntryPersistence,
        activatedAt = new Date(yield* Clock.currentTimeMillis).toISOString(),
        initialSnapshot: DefinitionSnapshotRecord = {
          activatedAt,
          compiled: snapshot,
          input: snapshot.input,
        },
        state = yield* SynchronizedRef.make<CatalogState>({
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
          revisions: snapshot.input.definitions.map((definition) => ({
            definition,
            definitionId: definition.id,
            revision: definition.revision ?? 1,
            ...(definition.parentRevision === undefined
              ? {}
              : { parentRevision: definition.parentRevision }),
          })),
          snapshots: [initialSnapshot],
          version: 1,
        });
      return DefinitionCatalog.of({
        commitCutover: (expectedVersion, replacement, expectedEntryGeneration, records) =>
          SynchronizedRef.modifyEffect(state, (current) => {
            if (current.version !== expectedVersion) {
              return Effect.fail(Conflict.make({ message: "Definition Catalog version is stale" }));
            }
            const committed = { ...cloneState(replacement), version: expectedVersion + 1 };
            return entryPersistence
              .commitGeneration(expectedEntryGeneration, records)
              .pipe(
                Effect.map(
                  (entries) => [{ catalog: cloneState(committed), entries }, committed] as const,
                ),
              );
          }),
        read: SynchronizedRef.get(state).pipe(Effect.map(cloneState)),
        replace: (expectedVersion, replacement) =>
          SynchronizedRef.modifyEffect(state, (current) => {
            if (current.version !== expectedVersion) {
              return Effect.fail(Conflict.make({ message: "Definition Catalog version is stale" }));
            }
            const committed = { ...cloneState(replacement), version: expectedVersion + 1 };
            return Effect.succeed([cloneState(committed), committed] as const);
          }),
      });
    }),
  );
