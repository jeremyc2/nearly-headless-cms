import { type CmsError, InvalidInput, NotFound } from "./cms-error.ts";
import type { EntryBatchMutation, EntryBatchMutationResult } from "./cms-types.ts";
import type { EntryGeneration, EntryRecord } from "./persistence.ts";
import type { CmsServiceOperationContext } from "./cms-service-operation-context.ts";
import type { CompiledSnapshot } from "./content-definition.ts";
import { Effect } from "effect";
import batchMutationsSupport from "./cms-service-entry-batch-operations-mutations-support.ts";
import entryOperationSupport from "./cms-service-entry-operation-support.ts";

interface PrepareBatchMutationInput {
  readonly context: CmsServiceOperationContext;
  readonly generation: EntryGeneration;
  readonly mutation: EntryBatchMutation;
  readonly records: Map<string, EntryRecord>;
  readonly snapshot: CompiledSnapshot;
}

const { assertLiveEntry, assertWriteToken } = entryOperationSupport,
  { authorizeBatchMutation, processBatchMutation } = batchMutationsSupport,
  prepareBatchMutation = (input: PrepareBatchMutationInput) =>
    Effect.gen(function* prepareBatchMutationEffect() {
      const { context, generation, mutation, records, snapshot } = input,
        { input: mutationInput } = mutation,
        contentType = snapshot.contentTypes.get(mutationInput.contentTypeId),
        current = records.get(mutationInput.entryId),
        liveCurrent = yield* assertLiveEntry(current, mutationInput.contentTypeId, mutationInput.entryId);
      yield* authorizeBatchMutation(context, snapshot, mutation);
      if (contentType === undefined) {
        return yield* NotFound.make({ message: `Entry ${mutationInput.entryId} was not found` });
      }
      yield* assertWriteToken(contentType, liveCurrent, mutationInput.writeToken);
      return {
        contentType,
        current: liveCurrent,
        entryId: mutationInput.entryId,
        generation,
        mutation,
        records,
        snapshot,
      };
    }),
  runMutateEntriesAtomically = (
    context: CmsServiceOperationContext,
    mutations: readonly EntryBatchMutation[],
  ): Effect.Effect<readonly EntryBatchMutationResult[], CmsError> =>
    Effect.gen(function* runMutateEntriesAtomicallyEffect() {
      if (mutations.length === 0) {
        return yield* InvalidInput.make({
          message: "An atomic Entry batch requires at least one mutation",
        });
      }
      const generation = yield* context.persistence.readGeneration,
        records = new Map(generation.records),
        results: EntryBatchMutationResult[] = [],
        snapshot = yield* context.currentDefinitionSnapshot;
      for (const mutation of mutations) {
        const batchInput = yield* prepareBatchMutation({
          context,
          generation,
          mutation,
          records,
          snapshot,
        });
        results.push(yield* processBatchMutation(context, batchInput));
      }
      yield* context.persistence.commitGeneration(generation.generation, records);
      return results;
    });

export default {
  runMutateEntriesAtomically,
};
