import type {
  AssetValue,
  CatalogState,
  CmsError,
  CompileOptions,
  CompiledSnapshot,
  CreateInput,
  CurrentState,
  Definition,
  DefinitionContract,
  DeletionRecord,
  Handler,
  IngestInput,
  ListRevisionsInput,
  Manifest,
  Preparation,
  Query,
  QueryPage,
  ReadInput,
  Representation,
  RestoreInput,
  Revision,
  RevisionPage,
  SnapshotInput,
  StoredAsset,
  UpdateInput,
} from "./cms-types-imports.ts";
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
  readonly readDefinitionCatalog: (_void: void) => Effect.Effect<CatalogState, CmsError>;
  readonly appendDefinitionRevision: (
    input: Readonly<AppendDefinitionRevisionInput>,
  ) => Effect.Effect<CatalogState, CmsError>;
  readonly activateDefinitionSnapshot: (
    input: Readonly<ActivateDefinitionSnapshotInput>,
  ) => Effect.Effect<ActivateDefinitionSnapshotResult, CmsError>;
  readonly retireDefinition: (
    input: Readonly<RetireDefinitionInput>,
  ) => Effect.Effect<CatalogState, CmsError>;
  readonly appendMigrationManifest: (
    input: Readonly<AppendMigrationManifestInput>,
  ) => Effect.Effect<CatalogState, CmsError>;
  readonly prepareDefinitionMigration: (
    input: Readonly<PrepareDefinitionMigrationInput>,
  ) => Effect.Effect<Preparation, CmsError>;
  readonly createEntry: (input: Readonly<CreateInput>) => Effect.Effect<MutationResult, CmsError>;
  readonly getEntry: (input: Readonly<ReadInput>) => Effect.Effect<Representation, CmsError>;
  readonly updateEntry: (input: Readonly<UpdateInput>) => Effect.Effect<MutationResult, CmsError>;
  readonly deleteEntry: (
    input: Readonly<DeleteEntryInput>,
  ) => Effect.Effect<DeleteResult, CmsError>;
  readonly mutateEntriesAtomically: (
    mutations: readonly EntryBatchMutation[],
  ) => Effect.Effect<readonly EntryBatchMutationResult[], CmsError>;
  readonly queryEntries: (query: Readonly<Query>) => Effect.Effect<QueryPage, CmsError>;
  readonly getCurrentEntryState: (
    input: Pick<ReadInput, "contentTypeId" | "entryId">,
  ) => Effect.Effect<CurrentState, CmsError>;
  readonly listEntryRevisions: (
    input: Readonly<ListRevisionsInput>,
  ) => Effect.Effect<RevisionPage, CmsError>;
  readonly inspectEntryRevision: (
    input: Readonly<ReadRevisionInput>,
  ) => Effect.Effect<Revision, CmsError>;
  readonly restoreEntryRevision: (
    input: Readonly<RestoreInput>,
  ) => Effect.Effect<CurrentState, CmsError>;
  readonly permanentlyPurgeEntry: (
    input: Readonly<PurgeEntryInput>,
  ) => Effect.Effect<void, CmsError>;
  readonly ingestAsset: <Input extends IngestInput>(
    input: Readonly<Input>,
  ) => Effect.Effect<AssetValue, CmsError>;
  readonly getAsset: (assetId: string) => Effect.Effect<AssetValue, CmsError>;
  readonly readAsset: (assetId: string) => Effect.Effect<StoredAsset, CmsError>;
  readonly listAssets: (_void: void) => Effect.Effect<readonly AssetValue[], CmsError>;
  readonly deleteAsset: (assetId: string) => Effect.Effect<void, CmsError>;
  readonly activeDefinitionSnapshot: (_void: void) => Effect.Effect<CompiledSnapshot, CmsError>;
  readonly readConsistentSnapshot: (_void: void) => Effect.Effect<ConsistentReadSnapshot, CmsError>;
}
