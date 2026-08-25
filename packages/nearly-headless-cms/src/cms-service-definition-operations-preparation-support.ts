import {
  type Asset,
  type CatalogState,
  type CmsError,
  type CmsServiceOperationContext,
  type CompiledSnapshot,
  Effect,
  type EntryGeneration,
  type Manifest,
  type Preparation,
  type PrepareDefinitionMigrationInput,
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
    context: Readonly<CmsServiceOperationContext>,
    action: DefinitionAuthorizationAction,
    definitionSpaceId: string,
  ): Effect.Effect<void, CmsError> =>
    context.authorize(action, { definitionSpaceId, kind: "definitionSpace" }),
  compileMigrationTarget = (
    context: Readonly<CmsServiceOperationContext>,
    snapshot: PrepareDefinitionMigrationInput["snapshot"],
  ): Effect.Effect<CompiledSnapshot, CmsError> =>
    attempt((): CompiledSnapshot => compileSnapshot(snapshot, context.compileOptions)),
  prepareMigrationPreparation = (
    context: Readonly<CmsServiceOperationContext>,
    input: PrepareMigrationPreparationInput,
  ): Effect.Effect<Preparation, CmsError> =>
    attempt(
      (): Preparation =>
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
    context: Readonly<CmsServiceOperationContext>,
    definitionSnapshot: CompiledSnapshot,
  ): Effect.Effect<
    {
      readonly assets: readonly Asset[];
      readonly entryGeneration: EntryGeneration;
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
      const assets = yield* context.assets.list(),
        entryGeneration = yield* context.persistence.readGeneration();
      return { assets, entryGeneration };
    }),
  readConsistentSnapshotData = (
    context: Readonly<CmsServiceOperationContext>,
  ): Effect.Effect<
    {
      readonly assets: readonly Asset[];
      readonly definitionSnapshot: CompiledSnapshot;
      readonly entryGeneration: EntryGeneration;
    },
    CmsError
  > =>
    Effect.gen(function* readConsistentSnapshotDataEffect() {
      const catalogState = yield* context.catalog.read(),
        definitionSnapshot = catalogState.active.compiled,
        snapshotRecords = yield* readAuthorizedConsistentSnapshotRecords(
          context,
          definitionSnapshot,
        );
      return {
        assets: snapshotRecords.assets,
        definitionSnapshot,
        entryGeneration: snapshotRecords.entryGeneration,
      };
    }),
  storePreparedDefinitionMigration = (
    context: Readonly<CmsServiceOperationContext>,
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
