import type { CatalogState, EntryGeneration } from "./persistence.ts";
import {
  type CmsError,
  InvalidInput,
} from "./cms-error.ts";
import type { CmsServiceOperationContext } from "./cms-service-operation-context.ts";
import type { CompiledSnapshot } from "./content-definition.ts";
import { Effect } from "effect";
import type { Manifest } from "./definition-migration-types.ts";
import type { Representation } from "./entry.ts";
import type { Revision } from "./entry-history.ts";
import cmsSupport from "./cms-support.ts";
import migrationHelpers from "./definition-migration-helpers.ts";
import { prepare } from "./definition-migration.ts";

interface MigrateRevisionValuesInput {
  readonly contentTypeId: string;
  readonly entryId: string;
  readonly generation: EntryGeneration;
  readonly snapshot: CompiledSnapshot;
  readonly sourceRevision: Revision;
}

interface ApplyManifestStepInput extends MigrateRevisionValuesInput {
  readonly catalogState: CatalogState;
  readonly manifest: Manifest;
  readonly sourceSnapshotId: string;
  readonly sourceValues: Representation["values"];
}

interface ResolvedManifestStepInput extends ApplyManifestStepInput {
  readonly sourceSnapshot: CompiledSnapshot;
  readonly targetSnapshot: CompiledSnapshot;
}

const { attempt } = cmsSupport,
  { searchMigrationPath, validateGraph } = migrationHelpers,
  applyManifestStep = (
    context: CmsServiceOperationContext,
    input: ApplyManifestStepInput,
  ): Effect.Effect<
    { readonly sourceSnapshotId: string; readonly sourceValues: Representation["values"] },
    CmsError
  > =>
    Effect.gen(function* applyManifestStepEffect() {
      const sourceSnapshot = findSnapshotById(input.catalogState, input.sourceSnapshotId),
        targetSnapshot = findSnapshotById(
          input.catalogState,
          input.manifest.targetSnapshotId,
        );
      if (sourceSnapshot === undefined || targetSnapshot === undefined) {
        return yield* InvalidInput.make({
          message: "Entry Revision migration references an unavailable Definition Snapshot",
        });
      }
      return yield* runManifestStep(context, { ...input, sourceSnapshot, targetSnapshot });
    }),
  findSnapshotById = (
    catalogState: CatalogState,
    snapshotId: string,
  ): CompiledSnapshot | undefined =>
    catalogState.snapshots.find(
      (snapshotRecord) => snapshotRecord.compiled.snapshotId === snapshotId,
    )?.compiled,
  migrateRevisionValues = (
    context: CmsServiceOperationContext,
    input: MigrateRevisionValuesInput,
  ): Effect.Effect<Representation["values"], CmsError> =>
    Effect.gen(function* migrateRevisionValuesEffect() {
      if (input.sourceRevision.definitionSnapshotId === input.snapshot.snapshotId) {
        return input.sourceRevision.values;
      }
      const catalogState = yield* context.catalog.read,
        manifests = yield* attempt(() =>
          resolveMigrationManifests(
            catalogState,
            input.sourceRevision.definitionSnapshotId,
            input.snapshot.snapshotId,
          ),
        );
      let sourceSnapshotId = input.sourceRevision.definitionSnapshotId,
        sourceValues = input.sourceRevision.values;
      for (const manifest of manifests) {
        ({ sourceSnapshotId, sourceValues } = yield* applyManifestStep(context, {
          catalogState,
          contentTypeId: input.contentTypeId,
          entryId: input.entryId,
          generation: input.generation,
          manifest,
          snapshot: input.snapshot,
          sourceRevision: input.sourceRevision,
          sourceSnapshotId,
          sourceValues,
        }));
      }
      return sourceValues;
    }),
  resolveMigrationManifests = (
    catalogState: CatalogState,
    sourceSnapshotId: string,
    targetSnapshotId: string,
  ): readonly Manifest[] => {
    validateGraph(catalogState.migrationManifests);
    const found = searchMigrationPath(
      catalogState.migrationManifests,
      sourceSnapshotId,
      targetSnapshotId,
    );
    if (found === undefined) {
      throw InvalidInput.make({
        message: `No Migration Path exists from ${sourceSnapshotId} to ${targetSnapshotId}`,
      });
    }
    return found;
  },
  runManifestStep = (
    context: CmsServiceOperationContext,
    input: ResolvedManifestStepInput,
  ): Effect.Effect<
    { readonly sourceSnapshotId: string; readonly sourceValues: Representation["values"] },
    CmsError
  > =>
    Effect.gen(function* runManifestStepEffect() {
      const preparation = yield* attempt(() =>
        prepare({
          entries: [
            {
              contentTypeId: input.contentTypeId,
              id: input.entryId,
              values: input.sourceValues,
            },
          ],
          handlers: [...context.migrationHandlers.values()],
          manifest: input.manifest,
          source: input.sourceSnapshot,
          sourceGeneration: input.generation.generation,
          target: input.targetSnapshot,
        }),
      );
      if (preparation.report.status !== "ready" || preparation.entries[0] === undefined) {
        if (preparation.report.status === "failed") {
          return yield* InvalidInput.make({
            issues: preparation.report.issues,
            message: "Entry Revision cannot be migrated to the active Definition Snapshot",
          });
        }
        return yield* InvalidInput.make({
          message: "Entry Revision cannot be migrated to the active Definition Snapshot",
        });
      }
      return {
        sourceSnapshotId: input.manifest.targetSnapshotId,
        sourceValues: preparation.entries[0].values,
      };
    });

export default {
  migrateRevisionValues,
};

export type { MigrateRevisionValuesInput };
