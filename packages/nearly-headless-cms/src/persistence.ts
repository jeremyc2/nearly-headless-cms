import type { Effect } from "effect";
import { Context } from "effect";
import type { CmsError, InfrastructureFailure } from "./cms-error.ts";
import type { CompiledSnapshot, SnapshotInput } from "./content-definition.ts";
import type { Representation } from "./entry.ts";
import type { DeletionRecord, Revision } from "./entry-history.ts";
import type { Manifest, Preparation } from "./definition-migration.ts";

/** Persisted current Entry state with optional history metadata. */
export interface EntryRecord {
  readonly entry: Representation;
  readonly writeToken?: string;
  readonly revisions: readonly Revision[];
  readonly deletionRecord?: DeletionRecord;
}

/** One immutable, internally consistent generation of Entry records. */
export interface EntryGeneration {
  readonly generation: number;
  readonly records: ReadonlyMap<string, EntryRecord>;
}

/** Builder-supplied atomic Entry persistence capability. */
export class EntryPersistence extends Context.Service<
  EntryPersistence,
  {
    readonly readGeneration: Effect.Effect<EntryGeneration, InfrastructureFailure>;
    readonly commitGeneration: (
      expectedGeneration: number,
      records: ReadonlyMap<string, EntryRecord>,
    ) => Effect.Effect<EntryGeneration, CmsError>;
  }
>()("nearly-headless-cms/Persistence/EntryPersistence") {}

/** One append-only Content Definition revision. */
export interface DefinitionRevisionRecord {
  readonly definitionId: string;
  readonly revision: number;
  readonly definition: SnapshotInput["definitions"][number];
  readonly parentRevision?: number;
}

/** A compiled immutable Definition Snapshot stored by the catalog. */
export interface DefinitionSnapshotRecord {
  readonly input: SnapshotInput;
  readonly compiled: CompiledSnapshot;
  readonly activatedAt: string;
}

/** An append-only event in the Definition Catalog lifecycle. */
export interface CatalogEvent {
  readonly eventType: "revisionAppended" | "snapshotActivated" | "definitionRetired" | "rollback";
  readonly recordedAt: string;
  readonly definitionId?: string;
  readonly snapshotId?: string;
  readonly source?: string;
}

/** Complete durable Definition Catalog state and active snapshot. */
export interface CatalogState {
  readonly active: DefinitionSnapshotRecord;
  readonly snapshots: readonly DefinitionSnapshotRecord[];
  readonly revisions: readonly DefinitionRevisionRecord[];
  readonly retiredDefinitionIds: ReadonlySet<string>;
  readonly events: readonly CatalogEvent[];
  readonly migrationManifests: readonly Manifest[];
  readonly migrationPreparations: readonly Preparation[];
  readonly version: number;
}

/** Builder-supplied append-only and atomically cut over Definition Catalog. */
export class DefinitionCatalog extends Context.Service<
  DefinitionCatalog,
  {
    readonly read: Effect.Effect<CatalogState, InfrastructureFailure>;
    readonly replace: (
      expectedVersion: number,
      state: CatalogState,
    ) => Effect.Effect<CatalogState, CmsError>;
    /** Atomically advances the active Definition Catalog and Entry generation. */
    readonly commitCutover: (
      expectedVersion: number,
      state: CatalogState,
      expectedEntryGeneration: number,
      records: ReadonlyMap<string, EntryRecord>,
    ) => Effect.Effect<
      { readonly catalog: CatalogState; readonly entries: EntryGeneration },
      CmsError
    >;
  }
>()("nearly-headless-cms/Persistence/DefinitionCatalog") {}
