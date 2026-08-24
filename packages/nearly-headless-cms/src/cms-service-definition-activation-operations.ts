import { type CmsError } from "./cms-error.ts";
import { type CmsServiceOperationContext } from "./cms-service-operation-context.ts";
import { Effect } from "effect";
import {
  type ActivateDefinitionSnapshotInput,
  type ActivateDefinitionSnapshotResult,
} from "./cms-types.ts";
import activationSupport from "./cms-service-definition-activation-support.ts";

const { applyMigrationRecords, commitDefinitionActivation, prepareActivationRecords } = activationSupport,
  activateDefinitionSnapshotOperation =
    (context: CmsServiceOperationContext) =>
    (input: ActivateDefinitionSnapshotInput): Effect.Effect<ActivateDefinitionSnapshotResult, CmsError> =>
      Effect.gen(function* activateDefinitionSnapshotOperationEffect() {
        yield* context.authorize("definition.activate", {
          definitionSpaceId: input.snapshot.definitionSpaceId,
          kind: "definitionSpace",
        });
        const { activation, records, state } = yield* prepareActivationRecords(context, input);
        if (activation.compatibility === "migrationRequired") {
          yield* applyMigrationRecords(context, { ...activation, records });
        }
        return yield* commitDefinitionActivation(context, {
          activation,
          expectedCatalogVersion: input.expectedCatalogVersion,
          input,
          records,
          state,
        });
      });

export default {
  activateDefinitionSnapshot: activateDefinitionSnapshotOperation,
};
