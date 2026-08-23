import type { Effect } from "effect";
import { Context } from "effect";
import type { CmsError, InfrastructureFailure } from "./CmsError.ts";
import type { CompiledSnapshot, SnapshotInput } from "./ContentDefinition.ts";
import type { Representation } from "./Entry.ts";
import type { DeletionRecord, Revision } from "./EntryHistory.ts";
import type { Manifest, Preparation } from "./DefinitionMigration.ts";

export interface EntryRecord {
  readonly entry: Representation;
  readonly writeToken?: string;
  readonly revisions: readonly Revision[];
  readonly deletionRecord?: DeletionRecord;
}

export interface EntryGeneration {
  readonly generation: number;
  readonly records: ReadonlyMap<string, EntryRecord>;
}

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

export interface DefinitionRevisionRecord {
  readonly definitionId: string;
  readonly revision: number;
  readonly definition: SnapshotInput["definitions"][number];
  readonly parentRevision?: number;
}

export interface DefinitionSnapshotRecord {
  readonly input: SnapshotInput;
  readonly compiled: CompiledSnapshot;
  readonly activatedAt: string;
}

export interface CatalogEvent {
  readonly eventType: "revisionAppended" | "snapshotActivated" | "definitionRetired" | "rollback";
  readonly recordedAt: string;
  readonly definitionId?: string;
  readonly snapshotId?: string;
  readonly source?: string;
}

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

export class DefinitionCatalog extends Context.Service<
  DefinitionCatalog,
  {
    readonly read: Effect.Effect<CatalogState, InfrastructureFailure>;
    readonly replace: (
      expectedVersion: number,
      state: CatalogState,
    ) => Effect.Effect<CatalogState, CmsError>;
  }
>()("nearly-headless-cms/Persistence/DefinitionCatalog") {}
