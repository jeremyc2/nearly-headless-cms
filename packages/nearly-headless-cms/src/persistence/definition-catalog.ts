import type { CmsError, InfrastructureFailure } from "../cms-error.ts";
import type { CompiledSnapshot, SnapshotInput } from "../content-definition.ts";
import { Context, type Effect } from "effect";
import type { EntryGeneration, EntryRecord } from "./entry-persistence.ts";
import type { Manifest, Preparation } from "../definition-migration.ts";

/** One append-only Content Definition revision. */
export interface DefinitionRevisionRecord {
  readonly definition: SnapshotInput["definitions"][number];
  readonly definitionId: string;
  readonly parentRevision?: number;
  readonly revision: number;
}

/** A compiled immutable Definition Snapshot stored by the catalog. */
export interface DefinitionSnapshotRecord {
  readonly activatedAt: string;
  readonly compiled: CompiledSnapshot;
  readonly input: SnapshotInput;
}

/** An append-only event in the Definition Catalog lifecycle. */
export interface CatalogEvent {
  readonly definitionId?: string;
  readonly eventType: "revisionAppended" | "snapshotActivated" | "definitionRetired" | "rollback";
  readonly recordedAt: string;
  readonly snapshotId?: string;
  readonly source?: string;
}

/** Complete durable Definition Catalog state and active snapshot. */
export interface CatalogState {
  readonly active: DefinitionSnapshotRecord;
  readonly events: readonly CatalogEvent[];
  readonly migrationManifests: readonly Manifest[];
  readonly migrationPreparations: readonly Preparation[];
  readonly retiredDefinitionIds: ReadonlySet<string>;
  readonly revisions: readonly DefinitionRevisionRecord[];
  readonly snapshots: readonly DefinitionSnapshotRecord[];
  readonly version: number;
}

/** The complete atomic Definition Catalog and Entry generation cutover. */
export interface CommitCutoverInput {
  readonly catalogState: CatalogState;
  readonly entryRecords: ReadonlyMap<string, EntryRecord>;
  readonly expectedCatalogVersion: number;
  readonly expectedEntryGeneration: number;
}

/** Builder-supplied append-only and atomically cut over Definition Catalog. */
export class DefinitionCatalog extends Context.Service<
  DefinitionCatalog,
  {
    /** Atomically advances the active Definition Catalog and Entry generation. */
    readonly commitCutover: (
      input: CommitCutoverInput,
    ) => Effect.Effect<
      { readonly catalog: CatalogState; readonly entries: EntryGeneration },
      CmsError
    >;
    readonly read: Effect.Effect<CatalogState, InfrastructureFailure>;
    readonly replace: (
      expectedVersion: number,
      state: CatalogState,
    ) => Effect.Effect<CatalogState, CmsError>;
  }
>()("nearly-headless-cms/persistence/definition-catalog/DefinitionCatalog") {}
