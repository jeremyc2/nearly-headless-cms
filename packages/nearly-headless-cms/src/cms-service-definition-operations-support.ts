import { DateTime, Effect } from "effect";
import {
  type CmsError,
  Conflict,
  NotFound,
} from "./cms-error.ts";
import {
  type CompiledSnapshot,
  compileSnapshot,
} from "./content-definition.ts";
import { type Preparation, validateGraph } from "./definition-migration.ts";
import {
  type AppendDefinitionRevisionInput,
  type AppendMigrationManifestInput,
  type ConsistentReadSnapshot,
  type PrepareDefinitionMigrationInput,
  type RetireDefinitionInput,
} from "./cms-types.ts";
import type { CmsServiceOperationContext } from "./cms-service-operation-context.ts";
import type { CatalogState } from "./persistence.ts";
import cmsSupport from "./cms-support.ts";
import definitionOperationsGuards from "./cms-service-definition-operations-guards.ts";
import definitionOperationsPreparationSupport from "./cms-service-definition-operations-preparation-support.ts";

type DefinitionAuthorizationAction = "definition.activate" | "definition.read" | "definition.write";

const { attempt, liveRecords, parentRevisionProperty, sourceProperty } = cmsSupport,
  {
    assertFreshCatalogVersion,
    findMigrationManifest,
    validateAppendDefinitionRevisionInput,
  } = definitionOperationsGuards,
  { readConsistentSnapshotData, storePreparedDefinitionMigration } =
    definitionOperationsPreparationSupport,
  authorizeDefinitionSpace = (
    context: CmsServiceOperationContext,
    action: DefinitionAuthorizationAction,
    definitionSpaceId: string,
  ): Effect.Effect<void, CmsError> =>
    context.authorize(action, { definitionSpaceId, kind: "definitionSpace" }),
  compileDraftDefinitionRevision = (
    context: CmsServiceOperationContext,
    state: CatalogState,
    input: AppendDefinitionRevisionInput,
  ): Effect.Effect<void, CmsError> =>
    Effect.gen(function* compileDraftDefinitionRevisionEffect() {
      const draftDefinitions = [
        ...state.active.input.definitions.filter(
          (definition) => definition.id !== input.definition.id,
        ),
        input.definition,
      ];
      yield* attempt((): void => {
        compileSnapshot(
          {
            compilerFormatVersion: state.active.compiled.compilerFormatVersion,
            definitionSpaceId: state.active.compiled.definitionSpaceId,
            definitions: draftDefinitions,
            snapshotId: `${state.active.compiled.snapshotId}-draft-check`,
          },
          context.compileOptions,
        );
      });
    }),
  readAuthorizedDefinitionCatalog = (
    context: CmsServiceOperationContext,
    action: DefinitionAuthorizationAction,
  ): Effect.Effect<CatalogState, CmsError> =>
    Effect.gen(function* readAuthorizedDefinitionCatalogEffect() {
      const state = yield* context.catalog.read;
      yield* authorizeDefinitionSpace(
        context,
        action,
        state.active.compiled.definitionSpaceId,
      );
      return state;
    }),
  readFreshAuthorizedCatalog = (
    context: CmsServiceOperationContext,
    action: DefinitionAuthorizationAction,
    expectedCatalogVersion: number,
  ): Effect.Effect<CatalogState, CmsError> =>
    Effect.gen(function* readFreshAuthorizedCatalogEffect() {
      const catalogState = yield* readAuthorizedDefinitionCatalog(context, action);
      yield* assertFreshCatalogVersion(catalogState, expectedCatalogVersion);
      return catalogState;
    }),
  runActiveDefinitionSnapshot = (
    context: CmsServiceOperationContext,
  ): Effect.Effect<CompiledSnapshot, CmsError> =>
    Effect.gen(function* runActiveDefinitionSnapshotEffect() {
      const catalogState = yield* readAuthorizedDefinitionCatalog(context, "definition.read");
      return catalogState.active.compiled;
    }),
  runAppendDefinitionRevision = (
    context: CmsServiceOperationContext,
    input: AppendDefinitionRevisionInput,
  ): Effect.Effect<CatalogState, CmsError> =>
    Effect.gen(function* runAppendDefinitionRevisionEffect() {
      const catalogState = yield* readFreshAuthorizedCatalog(
          context,
          "definition.write",
          input.expectedCatalogVersion,
        ),
        revisionResult = yield* validateAppendDefinitionRevisionInput(catalogState, input),
        savedAt = DateTime.formatIso(yield* DateTime.now);
      yield* compileDraftDefinitionRevision(context, catalogState, input);
      return yield* context.catalog.replace(input.expectedCatalogVersion, {
        ...catalogState,
        events: [
          ...catalogState.events,
          {
            definitionId: input.definition.id,
            eventType: "revisionAppended",
            recordedAt: savedAt,
            ...sourceProperty(input.source),
          },
        ],
        revisions: [
          ...catalogState.revisions,
          {
            definition: structuredClone(input.definition),
            definitionId: input.definition.id,
            revision: revisionResult.revision,
            ...parentRevisionProperty(input.definition.parentRevision),
          },
        ],
      });
    }),
  runAppendMigrationManifest = (
    context: CmsServiceOperationContext,
    input: AppendMigrationManifestInput,
  ): Effect.Effect<CatalogState, CmsError> =>
    Effect.gen(function* runAppendMigrationManifestEffect() {
      const catalogState = yield* readFreshAuthorizedCatalog(
        context,
        "definition.write",
        input.expectedCatalogVersion,
      );
      if (catalogState.migrationManifests.some((manifest) => manifest.id === input.manifest.id)) {
        return yield* Conflict.make({
          message: `Migration Manifest ${input.manifest.id} already exists`,
        });
      }
      yield* attempt(() => {
        validateGraph([...catalogState.migrationManifests, input.manifest]);
      });
      return yield* context.catalog.replace(input.expectedCatalogVersion, {
        ...catalogState,
        migrationManifests: [...catalogState.migrationManifests, structuredClone(input.manifest)],
      });
    }),
  runPrepareDefinitionMigration = (
    context: CmsServiceOperationContext,
    input: PrepareDefinitionMigrationInput,
  ): Effect.Effect<Preparation, CmsError> =>
    Effect.gen(function* runPrepareDefinitionMigrationEffect() {
      const catalogState = yield* readFreshAuthorizedCatalog(
          context,
          "definition.activate",
          input.expectedCatalogVersion,
        ),
        generation = yield* context.persistence.readGeneration,
        manifest = findMigrationManifest(catalogState, input.manifestId);
      if (manifest === undefined) {
        return yield* NotFound.make({
          message: `Migration Manifest ${input.manifestId} was not found`,
        });
      }
      return yield* storePreparedDefinitionMigration(context, {
        catalogState,
        expectedCatalogVersion: input.expectedCatalogVersion,
        generation,
        manifest,
        migrationInput: input,
      });
    }),
  runReadConsistentSnapshot = (
    context: CmsServiceOperationContext,
  ): Effect.Effect<ConsistentReadSnapshot, CmsError> =>
    Effect.gen(function* runReadConsistentSnapshotEffect() {
      const snapshotData = yield* readConsistentSnapshotData(context);
      return {
        assets: snapshotData.storedAssets,
        definitionSnapshot: snapshotData.definitionSnapshot,
        entries: liveRecords(snapshotData.entryGeneration).map((record) =>
          structuredClone(record.entry),
        ),
        generation: snapshotData.entryGeneration.generation,
      } satisfies ConsistentReadSnapshot;
    }),
  runReadDefinitionCatalog = (
    context: CmsServiceOperationContext,
  ): Effect.Effect<CatalogState, CmsError> =>
    readAuthorizedDefinitionCatalog(context, "definition.read"),
  runRetireDefinition = (
    context: CmsServiceOperationContext,
    input: RetireDefinitionInput,
  ): Effect.Effect<CatalogState, CmsError> =>
    Effect.gen(function* runRetireDefinitionEffect() {
      const catalogState = yield* readFreshAuthorizedCatalog(
        context,
        "definition.write",
        input.expectedCatalogVersion,
      );
      if (!catalogState.revisions.some((record) => record.definitionId === input.definitionId)) {
        return yield* NotFound.make({
          message: `Definition ${input.definitionId} was not found`,
        });
      }
      return yield* context.catalog.replace(input.expectedCatalogVersion, {
        ...catalogState,
        events: [
          ...catalogState.events,
          {
            definitionId: input.definitionId,
            eventType: "definitionRetired",
            recordedAt: DateTime.formatIso(yield* DateTime.now),
            ...sourceProperty(input.source),
          },
        ],
        retiredDefinitionIds: new Set(catalogState.retiredDefinitionIds).add(input.definitionId),
      });
    });

export default {
  runActiveDefinitionSnapshot,
  runAppendDefinitionRevision,
  runAppendMigrationManifest,
  runPrepareDefinitionMigration,
  runReadConsistentSnapshot,
  runReadDefinitionCatalog,
  runRetireDefinition,
};
