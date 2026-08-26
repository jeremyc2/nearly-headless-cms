import type { Asset, ContentDefinition, Persistence } from "nearly-headless-cms";
import { DateTime } from "effect";
import { initialGeneration, initialVersion } from "./sql-persistence-constants.ts";

export interface DiskAsset {
  readonly id: string;
  readonly metadata: Asset.Metadata;
}

export interface PersistenceState {
  readonly assets: ReadonlyMap<string, DiskAsset>;
  readonly catalog?: Persistence.CatalogState;
  readonly entryGeneration: number;
  readonly generation: number;
  readonly records: ReadonlyMap<string, Persistence.EntryRecord>;
}

export const cloneCatalog = (catalog: Persistence.CatalogState): Persistence.CatalogState => ({
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
});

export const clonePersistenceState = (state: PersistenceState): PersistenceState => {
  const clonedState: PersistenceState = {
    assets: new Map(
      [...state.assets].map(([assetIdentifier, asset]) => [assetIdentifier, structuredClone(asset)]),
    ),
    entryGeneration: state.entryGeneration,
    generation: state.generation,
    records: new Map(
      [...state.records].map(([entryIdentifier, record]) => [entryIdentifier, structuredClone(record)]),
    ),
  };
  if (state.catalog === undefined) {
    return clonedState;
  }
  return { ...clonedState, catalog: cloneCatalog(state.catalog) };
};

// oxlint-disable-next-line effecttsgo/missing-pipeable-signature -- [EH-325] catalog bootstrap is a pure helper shared by SQL persistence initialization.
export const initialCatalog = (
  snapshot: ContentDefinition.CompiledSnapshot,
  activatedAt: string,
): Persistence.CatalogState => {
  const { input } = snapshot,
    revisions = input.definitions.map((definition) => {
      const revision = {
        definition,
        definitionId: definition.id,
        revision: definition.revision ?? initialVersion,
      };
      if (definition.parentRevision === undefined) {
        return revision;
      }
      return { ...revision, parentRevision: definition.parentRevision };
    }),
    snapshotRecord = {
      activatedAt,
      compiled: snapshot,
      fingerprint: snapshot.fingerprint,
      input,
    };
  return {
    active: snapshotRecord,
    events: [],
    migrationManifests: [],
    migrationPreparations: [],
    retiredDefinitionIds: new Set<string>(),
    revisions,
    snapshots: [snapshotRecord],
    version: initialVersion,
  };
};

export const emptyPersistenceState = (
  definitionSnapshot: ContentDefinition.CompiledSnapshot | undefined,
): PersistenceState => {
  const state: PersistenceState = {
    assets: new Map(),
    entryGeneration: initialGeneration,
    generation: initialGeneration,
    records: new Map(),
  };
  if (definitionSnapshot === undefined) {
    return state;
  }
  return {
    ...state,
    catalog: initialCatalog(definitionSnapshot, DateTime.formatIso(DateTime.nowUnsafe())),
  };
};

export const toAssetRepresentation = (diskAsset: DiskAsset): Asset.Asset => ({
  id: diskAsset.id,
  metadata: diskAsset.metadata,
});
