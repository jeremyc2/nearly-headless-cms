import type { CmsServiceOperationContext, PurgeEntryInput } from "./cms-service-entry-history-guards-types.ts";
import { type CmsError } from "./cms-error.ts";
import { Effect } from "effect";
import entryHistoryGuards from "./cms-service-entry-history-guards.ts";

const { assertDeletedEntry, authorizeHistoryEntry } = entryHistoryGuards,
  runPermanentlyPurgeEntry = (
    context: Readonly<CmsServiceOperationContext>,
    input: PurgeEntryInput,
  ): Effect.Effect<void, CmsError> =>
    Effect.gen(function* runPermanentlyPurgeEntryEffect() {
      yield* authorizeHistoryEntry(context, {
        action: "entry.history.purge",
        contentTypeId: input.contentTypeId,
        entryId: input.entryId,
      });
      const generation = yield* context.persistence.readGeneration();
      yield* assertDeletedEntry(generation.records.get(input.entryId), input);
      yield* context.persistence.commitGeneration(
        generation.generation,
        new Map([...generation.records].filter(([entryId]) => entryId !== input.entryId)),
      );
    });

export default { runPermanentlyPurgeEntry };
