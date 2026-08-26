import {
  type ActivateDefinitionSnapshotInput,
  type CatalogState,
  type CmsError,
  Conflict,
  Effect,
  InvalidInput,
  assertFresh,
  cmsSupport,
} from "./cms-service-definition-activation-imports.ts";
import type { ActivationContext } from "./cms-service-definition-activation-types.ts";

const { attempt } = cmsSupport,
  validateActivationCatalogState = (
    state: CatalogState,
    input: ActivateDefinitionSnapshotInput,
  ): Effect.Effect<void, CmsError> =>
    Effect.gen(function* validateActivationCatalogStateEffect() {
      if (state.version !== input.expectedCatalogVersion) {
        return yield* Conflict.make({ message: "Definition Catalog version is stale" });
      }
      if (input.snapshot.definitionSpaceId !== state.active.compiled.definitionSpaceId) {
        return yield* InvalidInput.make({
          message: "A Definition Snapshot cannot cross Definition Spaces",
        });
      }
      if (
        state.snapshots.some(
          (snapshotRecord) => snapshotRecord.compiled.snapshotId === input.snapshot.snapshotId,
        )
      ) {
        return yield* Conflict.make({
          message: `Definition Snapshot ${input.snapshot.snapshotId} already exists`,
        });
      }
      return yield* Effect.void;
    }),
  validateActivationPreparation = (
    preparation: ActivationContext["preparation"],
    input: Pick<ActivationContext, "generation" | "manifest" | "source" | "target">,
  ): Effect.Effect<void, CmsError> =>
    Effect.gen(function* validateActivationPreparationEffect() {
      if (
        preparation.sourceSnapshotId !== input.source.snapshotId ||
        preparation.targetSnapshotId !== input.target.snapshotId ||
        preparation.manifest.id !== input.manifest.id
      ) {
        return yield* InvalidInput.make({
          message: "Migration Preparation does not match this Definition Cutover",
        });
      }
      yield* attempt(() => {
        assertFresh(preparation, input.generation.generation);
      });
      if (preparation.report.status !== "ready") {
        return yield* InvalidInput.make({
          issues: preparation.report.issues,
          message: "Definition Migration preparation failed",
        });
      }
      return yield* Effect.void;
    });

export default {
  validateActivationCatalogState,
  validateActivationPreparation,
};
