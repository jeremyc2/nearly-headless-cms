import {
  type CatalogState,
  type CmsError,
  type CmsServiceOperationContext,
  type CompiledSnapshot,
  Effect,
  type EntryGeneration,
  type Manifest,
  type Preparation,
  type PrepareDefinitionMigrationInput,
  type StoredAsset,
  cmsSupport,
  compileSnapshot,
  prepare,
} from "./cms-service-definition-operations-preparation-support-imports.ts";
type DefinitionAuthorizationAction = "definition.activate" | "definition.read" | "definition.write";

interface PrepareMigrationPreparationInput {
  readonly generation: EntryGeneration;
  readonly input: PrepareDefinitionMigrationInput;
  readonly manifest: Manifest;
  readonly state: CatalogState;
  readonly target: CompiledSnapshot;
}

const { attempt, entryResource, liveRecords } = cmsSupport,
  authorizeDefinitionSpace = (
    context: CmsServiceOperationContext,
    action: DefinitionAuthorizationAction,
    definitionSpaceId: string,
  ): Effect.Effect<void, CmsError> =>
    context.authorize(action, { definitionSpaceId, kind: "definitionSpace" }),
  compileMigrationTarget = (
    context: CmsServiceOperationContext,
    snapshot: PrepareDefinitionMigrationInput["snapshot"],
  ): Effect.Effect<CompiledSnapshot, CmsError> =>
    attempt((): CompiledSnapshot => compileSnapshot(snapshot, context.compileOptions)),
  loadStoredAssets = (
    context: CmsServiceOperationContext,
  ): Effect.Effect<readonly StoredAsset[], CmsError> =>
    Effect.gen(function* loadStoredAssetsEffect() {
      const assetMetadata = yield* context.assets.list,
        storedAssets: StoredAsset[] = [];
      for (const asset of assetMetadata) {
        storedAssets.push(yield* context.assets.read(asset.id));
      }
      return storedAssets;
    }),
  prepareMigrationPreparation = (
    context: CmsServiceOperationContext,
    input: PrepareMigrationPreparationInput,
  ): Effect.Effect<Preparation, CmsError> =>
    attempt((): Preparation =>
      prepare({
        entries: liveRecords(input.generation).map((record) => record.entry),
        handlers: [...context.migrationHandlers.values()],
        manifest: input.manifest,
        source: input.state.active.compiled,
        sourceGeneration: input.generation.generation,
        target: input.target,
      }),
    ),
  readAuthorizedConsistentSnapshotRecords = (
    context: CmsServiceOperationContext,
    definitionSnapshot: CompiledSnapshot,
  ): Effect.Effect<
    {
      readonly entryGeneration: EntryGeneration;
      readonly storedAssets: readonly StoredAsset[];
    },
    CmsError
  > =>
    Effect.gen(function* readAuthorizedConsistentSnapshotRecordsEffect() {
      yield* authorizeDefinitionSpace(
        context,
        "definition.read",
        definitionSnapshot.definitionSpaceId,
      );
      for (const contentTypeId of definitionSnapshot.contentTypes.keys()) {
        yield* context.authorize("entry.query", entryResource(definitionSnapshot, contentTypeId));
      }
      yield* context.authorize("asset.read", {
        definitionSpaceId: definitionSnapshot.definitionSpaceId,
        kind: "asset",
      });
      const entryGeneration = yield* context.persistence.readGeneration,
        storedAssets = yield* loadStoredAssets(context);
      return { entryGeneration, storedAssets };
    }),
  readConsistentSnapshotData = (
    context: CmsServiceOperationContext,
  ): Effect.Effect<
    {
      readonly definitionSnapshot: CompiledSnapshot;
      readonly entryGeneration: EntryGeneration;
      readonly storedAssets: readonly StoredAsset[];
    },
    CmsError
  > =>
    Effect.gen(function* readConsistentSnapshotDataEffect() {
      const catalogState = yield* context.catalog.read,
        definitionSnapshot = catalogState.active.compiled,
        { entryGeneration, storedAssets } = yield* readAuthorizedConsistentSnapshotRecords(
          context,
          definitionSnapshot,
        );
      return { definitionSnapshot, entryGeneration, storedAssets };
    }),
  storePreparedDefinitionMigration = (
    context: CmsServiceOperationContext,
    input: {
      readonly catalogState: CatalogState;
      readonly expectedCatalogVersion: number;
      readonly generation: EntryGeneration;
      readonly manifest: Manifest;
      readonly migrationInput: PrepareDefinitionMigrationInput;
    },
  ): Effect.Effect<Preparation, CmsError> =>
    Effect.gen(function* storePreparedDefinitionMigrationEffect() {
      const storedMigrationPreparation = yield* prepareMigrationPreparation(context, {
        generation: input.generation,
        input: input.migrationInput,
        manifest: input.manifest,
        state: input.catalogState,
        target: yield* compileMigrationTarget(context, input.migrationInput.snapshot),
      });
      yield* context.catalog.replace(input.expectedCatalogVersion, {
        ...input.catalogState,
        migrationPreparations: [
          ...input.catalogState.migrationPreparations.filter(
            (candidate) => candidate.id !== storedMigrationPreparation.id,
          ),
          storedMigrationPreparation,
        ],
      });
      return storedMigrationPreparation;
    });

export default {
  readConsistentSnapshotData,
  storePreparedDefinitionMigration,
};
