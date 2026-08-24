import { Effect } from "effect";
import type { CompiledSnapshot } from "./content-definition.ts";
import { type Manifest, path as migrationPath, prepare } from "./definition-migration.ts";
import type { Representation } from "./entry.ts";
import type { Revision } from "./entry-history.ts";
import { type CmsError, InvalidInput } from "./cms-error.ts";
import type { CatalogState, EntryGeneration } from "./persistence.ts";
import cmsSupport from "./cms-support.ts";
import type { CmsServiceOperationContext } from "./cms-service-operation-context.ts";

const { attempt } = cmsSupport;

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

const applyManifestStep = (
  context: CmsServiceOperationContext,
  input: ApplyManifestStepInput,
): Effect.Effect<{ readonly sourceSnapshotId: string; readonly sourceValues: Representation["values"] }, CmsError> =>
  Effect.gen(function* applyManifestStepEffect() {
    const sourceSnapshot = input.catalogState.snapshots.find(
        (snapshotRecord) => snapshotRecord.compiled.snapshotId === input.sourceSnapshotId,
      )?.compiled,
      targetSnapshot = input.catalogState.snapshots.find(
        (snapshotRecord) =>
          snapshotRecord.compiled.snapshotId === input.manifest.targetSnapshotId,
      )?.compiled;
    if (sourceSnapshot === undefined || targetSnapshot === undefined) {
      return yield* InvalidInput.make({
        message: "Entry Revision migration references an unavailable Definition Snapshot",
      });
    }
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
        source: sourceSnapshot,
        sourceGeneration: input.generation.generation,
        target: targetSnapshot,
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
  }),
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
          migrationPath(
            catalogState.migrationManifests,
            input.sourceRevision.definitionSnapshotId,
            input.snapshot.snapshotId,
          ),
        );
      let sourceSnapshotId = input.sourceRevision.definitionSnapshotId,
        sourceValues = input.sourceRevision.values;
      for (const manifest of manifests) {
        const step = yield* applyManifestStep(context, {
          catalogState,
          contentTypeId: input.contentTypeId,
          entryId: input.entryId,
          generation: input.generation,
          manifest,
          snapshot: input.snapshot,
          sourceRevision: input.sourceRevision,
          sourceSnapshotId,
          sourceValues,
        });
        sourceSnapshotId = step.sourceSnapshotId;
        sourceValues = step.sourceValues;
      }
      return sourceValues;
    });

export default {
  migrateRevisionValues,
};

export type { MigrateRevisionValuesInput };
