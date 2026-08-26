import type { Persistence } from "nearly-headless-cms";
import { ContentDefinition } from "nearly-headless-cms";
import type { DiskAsset, PersistenceState } from "./sql-persistence-state.ts";

interface SerializedCatalogSnapshot {
  readonly activatedAt: string;
  readonly input: ContentDefinition.SnapshotInput;
}

interface SerializedCatalogState {
  readonly active: SerializedCatalogSnapshot;
  readonly events: Persistence.CatalogState["events"];
  readonly migrationManifests: Persistence.CatalogState["migrationManifests"];
  readonly migrationPreparations: Persistence.CatalogState["migrationPreparations"];
  readonly retiredDefinitionIds: readonly string[];
  readonly revisions: Persistence.CatalogState["revisions"];
  readonly snapshots: readonly SerializedCatalogSnapshot[];
  readonly version: number;
}

const defaultCompileOptions: ContentDefinition.CompileOptions = {},
  encodeCatalog = (catalog: Persistence.CatalogState): SerializedCatalogState => ({
    active: {
      activatedAt: catalog.active.activatedAt,
      input: catalog.active.input,
    },
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
  findActiveSnapshot = (
    snapshots: readonly Persistence.DefinitionSnapshotRecord[],
    activeInputSnapshotId: string,
  ): Persistence.DefinitionSnapshotRecord => {
    const active = snapshots.find(
      (snapshot) => snapshot.input.snapshotId === activeInputSnapshotId,
    );
    if (active === undefined) {
      throw new Error("Committed Definition Catalog active Snapshot is missing");
    }
    return active;
  },
  decodeCatalog = (
    catalog: SerializedCatalogState,
    compileOptions: ContentDefinition.CompileOptions = defaultCompileOptions,
  ): Persistence.CatalogState => {
    const activeInputSnapshotId = catalog.active.input.snapshotId,
      snapshots = catalog.snapshots.map((snapshot) => ({
        activatedAt: snapshot.activatedAt,
        compiled: ContentDefinition.compileSnapshot(snapshot.input, compileOptions),
        input: snapshot.input,
      }));
    return {
      active: findActiveSnapshot(snapshots, activeInputSnapshotId),
      events: structuredClone(catalog.events),
      migrationManifests: structuredClone(catalog.migrationManifests),
      migrationPreparations: structuredClone(catalog.migrationPreparations),
      retiredDefinitionIds: new Set(catalog.retiredDefinitionIds),
      revisions: structuredClone(catalog.revisions),
      snapshots,
      version: catalog.version,
    };
  };

export interface PersistedStateRow {
  readonly assets_json: string;
  readonly catalog_json: string | null;
  readonly entry_generation: number;
  readonly records_json: string;
  readonly storage_generation: number;
}

export const encodePersistenceState = (state: PersistenceState): PersistedStateRow => ({
  assets_json: JSON.stringify([...state.assets.entries()]),
  catalog_json: state.catalog === undefined ? null : JSON.stringify(encodeCatalog(state.catalog)),
  entry_generation: state.entryGeneration,
  records_json: JSON.stringify([...state.records.entries()]),
  storage_generation: state.generation,
});

// oxlint-disable-next-line effecttsgo/missing-pipeable-signature -- [EH-326] persistence codec helpers are plain functions at the SQL adapter boundary.
export const decodePersistenceState = (
  row: PersistedStateRow,
  compileOptions: ContentDefinition.CompileOptions = defaultCompileOptions,
): PersistenceState => {
  const recordsEntries = JSON.parse(row.records_json) as readonly (readonly [
      string,
      Persistence.EntryRecord,
    ])[],
    assetsEntries = JSON.parse(row.assets_json) as readonly (readonly [string, DiskAsset])[],
    catalog =
      row.catalog_json === null
        ? undefined
        : decodeCatalog(JSON.parse(row.catalog_json) as SerializedCatalogState, compileOptions);
  return {
    assets: new Map(assetsEntries),
    catalog,
    entryGeneration: row.entry_generation,
    generation: row.storage_generation,
    records: new Map(recordsEntries),
  };
};
