import type { CatalogState, DefinitionSnapshotRecord } from "../../persistence.ts";
import {
  type CompileOptions,
  type CompiledSnapshot,
  compileSnapshot,
} from "../../content-definition.ts";
import { type DiskCatalog, initialVersion } from "./bun-filesystem-persistence-types.ts";

const catalogGenerationFields = (
    catalog: CatalogState | undefined,
  ): { readonly catalog?: DiskCatalog } => {
    if (catalog === undefined) {
      return {};
    }
    return { catalog: encodeCatalog(catalog) };
  },
  decodeCatalog = (catalog: DiskCatalog, compileOptions: CompileOptions): CatalogState => {
    const activeInputSnapshotId = catalog.active.input.snapshotId,
      snapshots = catalog.snapshots.map((snapshot) => ({
        ...snapshot,
        compiled: compileSnapshot(snapshot.input, compileOptions),
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
  findActiveSnapshot = (
    snapshots: readonly DefinitionSnapshotRecord[],
    activeInputSnapshotId: string,
  ): DefinitionSnapshotRecord => {
    const active = snapshots.find(
      (snapshot) => snapshot.input.snapshotId === activeInputSnapshotId,
    );
    if (active === undefined) {
      throw new Error("Committed Definition Catalog active Snapshot is missing");
    }
    return active;
  },
  initialCatalog = (snapshot: CompiledSnapshot, activatedAt: string): CatalogState => {
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
      snapshotRecord: DefinitionSnapshotRecord = {
        activatedAt,
        compiled: snapshot,
        input,
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
      revisions,
      snapshots: [snapshotRecord],
      version: initialVersion,
    };
  };

export default { catalogGenerationFields, decodeCatalog, initialCatalog };
