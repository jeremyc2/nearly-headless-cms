import type { Asset as AssetValue, IngestInput, StoredAsset } from "./asset.ts";
import type {
  CompileOptions,
  CompiledSnapshot,
  Definition,
  SnapshotInput,
} from "./content-definition.ts";
import type { Handler, Manifest, Preparation } from "./definition-migration.ts";
import type {
  CurrentState,
  DeletionRecord,
  ListRevisionsInput,
  RestoreInput,
  Revision,
  RevisionPage,
} from "./entry-history.ts";
import type { Query, QueryPage } from "./entry-query.ts";
import type { CreateInput, ReadInput, Representation, UpdateInput } from "./entry.ts";
import type { CmsError } from "./cms-error.ts";
import type { DefinitionContract } from "./operation.ts";
import type { CatalogState } from "./persistence.ts";
import type { Effect } from "effect";

export type MutationResult = Representation | CurrentState;
export type DeleteResult = void | DeletionRecord;
export interface ConsistentReadSnapshot {
  readonly assets: readonly StoredAsset[];
  readonly definitionSnapshot: CompiledSnapshot;
  readonly entries: readonly Representation[];
  readonly generation: number;
}
export interface DeleteEntryInput {
  readonly contentTypeId: string;
  readonly entryId: string;
  readonly writeToken?: string;
}
export interface PurgeEntryInput {
  readonly contentTypeId: string;
  readonly entryId: string;
  readonly writeToken: string;
}
export type EntryBatchMutation =
  | { readonly kind: "replace"; readonly input: UpdateInput }
  | { readonly kind: "delete"; readonly input: DeleteEntryInput };
export type EntryBatchMutationResult = MutationResult | DeleteResult;
export interface ReadRevisionInput {
  readonly contentTypeId: string;
  readonly entryId: string;
  readonly revisionNumber: number;
}
export interface AppendDefinitionRevisionInput {
  readonly expectedCatalogVersion: number;
  readonly definition: Definition;
  readonly source?: string;
}
export interface ActivateDefinitionSnapshotInput {
  readonly expectedCatalogVersion: number;
  readonly snapshot: SnapshotInput;
  readonly migration?: {
    readonly manifest: Manifest;
    readonly handlers?: readonly Handler[];
    readonly preparationId?: string;
  };
  readonly source?: string;
}
export interface ActivateDefinitionSnapshotResult {
  readonly snapshot: CompiledSnapshot;
  readonly catalogVersion: number;
  readonly migratedEntryCount: number;
}
export interface RetireDefinitionInput {
  readonly expectedCatalogVersion: number;
  readonly definitionId: string;
  readonly source?: string;
}
export interface AppendMigrationManifestInput {
  readonly expectedCatalogVersion: number;
  readonly manifest: Manifest;
}
export interface PrepareDefinitionMigrationInput {
  readonly expectedCatalogVersion: number;
  readonly manifestId: string;
  readonly snapshot: SnapshotInput;
}
export interface CmsLayerOptions extends CompileOptions {
  readonly migrationHandlers?: readonly Handler[];
  readonly operationContracts?: readonly DefinitionContract[];
}
export interface ServiceShape {
  readonly readDefinitionCatalog: Effect.Effect<CatalogState, CmsError>;
  readonly appendDefinitionRevision: (
    input: AppendDefinitionRevisionInput,
  ) => Effect.Effect<CatalogState, CmsError>;
  readonly activateDefinitionSnapshot: (
    input: ActivateDefinitionSnapshotInput,
  ) => Effect.Effect<ActivateDefinitionSnapshotResult, CmsError>;
  readonly retireDefinition: (
    input: RetireDefinitionInput,
  ) => Effect.Effect<CatalogState, CmsError>;
  readonly appendMigrationManifest: (
    input: AppendMigrationManifestInput,
  ) => Effect.Effect<CatalogState, CmsError>;
  readonly prepareDefinitionMigration: (
    input: PrepareDefinitionMigrationInput,
  ) => Effect.Effect<Preparation, CmsError>;
  readonly createEntry: (input: CreateInput) => Effect.Effect<MutationResult, CmsError>;
  readonly getEntry: (input: ReadInput) => Effect.Effect<Representation, CmsError>;
  readonly updateEntry: (input: UpdateInput) => Effect.Effect<MutationResult, CmsError>;
  readonly deleteEntry: (input: DeleteEntryInput) => Effect.Effect<DeleteResult, CmsError>;
  readonly mutateEntriesAtomically: (
    mutations: readonly EntryBatchMutation[],
  ) => Effect.Effect<readonly EntryBatchMutationResult[], CmsError>;
  readonly queryEntries: (query: Query) => Effect.Effect<QueryPage, CmsError>;
  readonly getCurrentEntryState: (
    input: Pick<ReadInput, "contentTypeId" | "entryId">,
  ) => Effect.Effect<CurrentState, CmsError>;
  readonly listEntryRevisions: (input: ListRevisionsInput) => Effect.Effect<RevisionPage, CmsError>;
  readonly inspectEntryRevision: (input: ReadRevisionInput) => Effect.Effect<Revision, CmsError>;
  readonly restoreEntryRevision: (input: RestoreInput) => Effect.Effect<CurrentState, CmsError>;
  readonly permanentlyPurgeEntry: (input: PurgeEntryInput) => Effect.Effect<void, CmsError>;
  readonly ingestAsset: (input: IngestInput) => Effect.Effect<AssetValue, CmsError>;
  readonly getAsset: (assetId: string) => Effect.Effect<AssetValue, CmsError>;
  readonly readAsset: (assetId: string) => Effect.Effect<StoredAsset, CmsError>;
  readonly listAssets: Effect.Effect<readonly AssetValue[], CmsError>;
  readonly deleteAsset: (assetId: string) => Effect.Effect<void, CmsError>;
  readonly activeDefinitionSnapshot: Effect.Effect<CompiledSnapshot, CmsError>;
  readonly readConsistentSnapshot: Effect.Effect<ConsistentReadSnapshot, CmsError>;
}
