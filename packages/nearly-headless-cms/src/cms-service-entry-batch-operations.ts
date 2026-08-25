import type { EntryBatchMutation, EntryBatchMutationResult } from "./cms-types.ts";
import type { CmsError } from "./cms-error.ts";
import type { CmsServiceOperationContext } from "./cms-service-operation-context.ts";
import type { Effect } from "effect";
import entryBatchOperationsSupport from "./cms-service-entry-batch-operations-support.ts";

const { runMutateEntriesAtomically } = entryBatchOperationsSupport,
  mutateEntriesAtomicallyOperation =
    (context: CmsServiceOperationContext) =>
    (mutations: readonly EntryBatchMutation[]): Effect.Effect<readonly EntryBatchMutationResult[], CmsError> =>
      runMutateEntriesAtomically(context, mutations);

export default {
  mutateEntriesAtomically: mutateEntriesAtomicallyOperation,
};
