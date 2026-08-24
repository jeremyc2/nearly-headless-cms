import { DateTime, Effect } from "effect";
import type { StoredAsset } from "./asset.ts";
import {
  type CmsError,
  Conflict,
  InvalidInput,
  NotFound,
} from "./cms-error.ts";
import { compile } from "./content-definition.ts";
import { type Preparation, prepare, validateGraph } from "./definition-migration.ts";
import type { CatalogState } from "./persistence.ts";
import cmsSupport from "./cms-support.ts";
import type { CmsServiceOperationContext } from "./cms-service-operation-context.ts";
import type {
  AppendDefinitionRevisionInput,
  AppendMigrationManifestInput,
  ConsistentReadSnapshot,
  PrepareDefinitionMigrationInput,
  RetireDefinitionInput,
} from "./cms-types.ts";

const { attempt, entryResource, liveRecords, parentRevisionProperty, sourceProperty } = cmsSupport,

 activeDefinitionSnapshotOperation = (context: CmsServiceOperationContext) =>
  Effect.gen(function* activeDefinitionSnapshot() {
    const state = yield* context.catalog.read;
    yield* context.authorize("definition.read", {
      definitionSpaceId: state.active.compiled.definitionSpaceId,
      kind: "definitionSpace",
    });
    return state.active.compiled;
  }),

 appendDefinitionRevisionOperation =
  (context: CmsServiceOperationContext) =>
  (input: AppendDefinitionRevisionInput): Effect.Effect<CatalogState, CmsError> =>
    Effect.gen(function* appendDefinitionRevisionOperationEffect() {
      const state = yield* context.catalog.read;
      yield* context.authorize("definition.write", {
        definitionSpaceId: state.active.compiled.definitionSpaceId,
        kind: "definitionSpace",
      });
      if (state.version !== input.expectedCatalogVersion) {
        return yield* Conflict.make({ message: "Definition Catalog version is stale" });
      }
      const revision = input.definition.revision ?? 1;
      if (!Number.isSafeInteger(revision) || revision <= 0) {
        return yield* InvalidInput.make({
          message: "Definition revision must be a positive safe integer",
        });
      }
      if (
        state.revisions.some(
          (record) =>
            record.definitionId === input.definition.id && record.revision === revision,
        )
      ) {
        return yield* Conflict.make({
          message: `Definition ${input.definition.id} revision ${revision} already exists`,
        });
      }
      const previousRevisions = state.revisions.filter(
          (record) => record.definitionId === input.definition.id,
        ),
        previousRevision = previousRevisions.reduce(
          (maximum, record) => Math.max(maximum, record.revision),
          0,
        );
      if (previousRevision > 0 && input.definition.parentRevision !== previousRevision) {
        return yield* Conflict.make({
          message: `Definition ${input.definition.id} must name parent revision ${previousRevision}`,
        });
      }
      if (previousRevision === 0 && input.definition.parentRevision !== undefined) {
        return yield* InvalidInput.make({
          message: `The first revision of Definition ${input.definition.id} cannot name a parent`,
        });
      }
      const draftDefinitions = [
        ...state.active.input.definitions.filter(
          (definition) => definition.id !== input.definition.id,
        ),
        input.definition,
      ];
      yield* attempt(() =>
        compile(
          {
            compilerFormatVersion: state.active.compiled.compilerFormatVersion,
            definitionSpaceId: state.active.compiled.definitionSpaceId,
            definitions: draftDefinitions,
            snapshotId: `${state.active.compiled.snapshotId}-draft-check`,
          },
          context.compileOptions,
        ),
      );
      const recordedAt = DateTime.formatIso(yield* DateTime.now);
      return yield* context.catalog.replace(input.expectedCatalogVersion, {
        ...state,
        events: [
          ...state.events,
          {
            definitionId: input.definition.id,
            eventType: "revisionAppended",
            recordedAt,
            ...sourceProperty(input.source),
          },
        ],
        revisions: [
          ...state.revisions,
          {
            definition: structuredClone(input.definition),
            definitionId: input.definition.id,
            revision,
            ...parentRevisionProperty(input.definition.parentRevision),
          },
        ],
      });
    }),

 appendMigrationManifestOperation =
  (context: CmsServiceOperationContext) =>
  (input: AppendMigrationManifestInput): Effect.Effect<CatalogState, CmsError> =>
    Effect.gen(function* appendMigrationManifestOperationEffect() {
      const state = yield* context.catalog.read;
      yield* context.authorize("definition.write", {
        definitionSpaceId: state.active.compiled.definitionSpaceId,
        kind: "definitionSpace",
      });
      if (state.version !== input.expectedCatalogVersion) {
        return yield* Conflict.make({ message: "Definition Catalog version is stale" });
      }
      if (state.migrationManifests.some((manifest) => manifest.id === input.manifest.id)) {
        return yield* Conflict.make({
          message: `Migration Manifest ${input.manifest.id} already exists`,
        });
      }
      yield* attempt(() => {
        validateGraph([...state.migrationManifests, input.manifest]);
      });
      return yield* context.catalog.replace(input.expectedCatalogVersion, {
        ...state,
        migrationManifests: [...state.migrationManifests, structuredClone(input.manifest)],
      });
    }),

 prepareDefinitionMigrationOperation =
  (context: CmsServiceOperationContext) =>
  (input: PrepareDefinitionMigrationInput): Effect.Effect<Preparation, CmsError> =>
    Effect.gen(function* prepareDefinitionMigrationOperationEffect() {
      const state = yield* context.catalog.read;
      yield* context.authorize("definition.activate", {
        definitionSpaceId: state.active.compiled.definitionSpaceId,
        kind: "definitionSpace",
      });
      if (state.version !== input.expectedCatalogVersion) {
        return yield* Conflict.make({ message: "Definition Catalog version is stale" });
      }
      const manifest = state.migrationManifests.find(
        (candidate) => candidate.id === input.manifestId,
      );
      if (manifest === undefined) {
        return yield* NotFound.make({
          message: `Migration Manifest ${input.manifestId} was not found`,
        });
      }
      const target = yield* attempt(() => compile(input.snapshot, context.compileOptions)),
        generation = yield* context.persistence.readGeneration,
        preparation = yield* attempt(() =>
          prepare({
            entries: liveRecords(generation).map((record) => record.entry),
            handlers: [...context.migrationHandlers.values()],
            manifest,
            source: state.active.compiled,
            sourceGeneration: generation.generation,
            target,
          }),
        );
      yield* context.catalog.replace(input.expectedCatalogVersion, {
        ...state,
        migrationPreparations: [
          ...state.migrationPreparations.filter((candidate) => candidate.id !== preparation.id),
          preparation,
        ],
      });
      return preparation;
    }),

 readConsistentSnapshotOperation = (context: CmsServiceOperationContext) =>
  Effect.gen(function* readConsistentSnapshot() {
    const catalogState = yield* context.catalog.read,
      definitionSnapshot = catalogState.active.compiled;
    yield* context.authorize("definition.read", {
      definitionSpaceId: definitionSnapshot.definitionSpaceId,
      kind: "definitionSpace",
    });
    for (const contentTypeId of definitionSnapshot.contentTypes.keys()) {
      yield* context.authorize("entry.query", entryResource(definitionSnapshot, contentTypeId));
    }
    yield* context.authorize("asset.read", {
      definitionSpaceId: definitionSnapshot.definitionSpaceId,
      kind: "asset",
    });
    const generation = yield* context.persistence.readGeneration,
      assetMetadata = yield* context.assets.list,
      storedAssets: StoredAsset[] = [];
    for (const asset of assetMetadata) {
      storedAssets.push(yield* context.assets.read(asset.id));
    }
    return {
      assets: storedAssets,
      definitionSnapshot,
      entries: liveRecords(generation).map((record) => structuredClone(record.entry)),
      generation: generation.generation,
    } satisfies ConsistentReadSnapshot;
  }),

 readDefinitionCatalogOperation = (context: CmsServiceOperationContext) =>
  Effect.gen(function* readDefinitionCatalog() {
    const state = yield* context.catalog.read;
    yield* context.authorize("definition.read", {
      definitionSpaceId: state.active.compiled.definitionSpaceId,
      kind: "definitionSpace",
    });
    return state;
  }),

 retireDefinitionOperation =
  (context: CmsServiceOperationContext) =>
  (input: RetireDefinitionInput): Effect.Effect<CatalogState, CmsError> =>
    Effect.gen(function* retireDefinitionOperationEffect() {
      const state = yield* context.catalog.read;
      yield* context.authorize("definition.write", {
        definitionSpaceId: state.active.compiled.definitionSpaceId,
        kind: "definitionSpace",
      });
      if (state.version !== input.expectedCatalogVersion) {
        return yield* Conflict.make({ message: "Definition Catalog version is stale" });
      }
      if (!state.revisions.some((record) => record.definitionId === input.definitionId)) {
        return yield* NotFound.make({
          message: `Definition ${input.definitionId} was not found`,
        });
      }
      const recordedAt = DateTime.formatIso(yield* DateTime.now);
      return yield* context.catalog.replace(input.expectedCatalogVersion, {
        ...state,
        events: [
          ...state.events,
          {
            definitionId: input.definitionId,
            eventType: "definitionRetired",
            recordedAt,
            ...sourceProperty(input.source),
          },
        ],
        retiredDefinitionIds: new Set(state.retiredDefinitionIds).add(input.definitionId),
      });
    });

export default {
  activeDefinitionSnapshot: activeDefinitionSnapshotOperation,
  appendDefinitionRevision: appendDefinitionRevisionOperation,
  appendMigrationManifest: appendMigrationManifestOperation,
  prepareDefinitionMigration: prepareDefinitionMigrationOperation,
  readConsistentSnapshot: readConsistentSnapshotOperation,
  readDefinitionCatalog: readDefinitionCatalogOperation,
  retireDefinition: retireDefinitionOperation,
};
