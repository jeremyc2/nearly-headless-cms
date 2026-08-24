import { Clock, Effect, Layer, SynchronizedRef } from "effect";
import type { CompiledSnapshot } from "../ContentDefinition.ts";
import { Conflict } from "../CmsError.ts";
import {
  type CatalogState,
  DefinitionCatalog,
  type DefinitionSnapshotRecord,
} from "../Persistence.ts";

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

export const layer = ({ snapshot }: Options): Layer.Layer<DefinitionCatalog> =>
  Layer.effect(
    DefinitionCatalog,
    Effect.gen(function* layer() {
      const activatedAt = new Date(yield* Clock.currentTimeMillis).toISOString(),
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
