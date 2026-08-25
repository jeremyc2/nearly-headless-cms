import { Clock, DateTime, Effect } from "effect";
import { type CmsError, NotFound } from "./cms-error.ts";
import type { CompiledContentType, CompiledSnapshot } from "./content-definition.ts";
import type { EntryGeneration, EntryRecord } from "./persistence.ts";
import type { CmsServiceOperationContext } from "./cms-service-operation-context.ts";
import type { DeleteEntryInput } from "./cms-types.ts";
import type { DeletionRecord } from "./entry-history.ts";
import cmsSupport from "./cms-support.ts";
import entryOperationSupport from "./cms-service-entry-operation-support.ts";

interface PreparedDeleteEntry {
  readonly contentType: CompiledContentType;
  readonly current: EntryRecord;
  readonly generation: EntryGeneration;
  readonly records: Map<string, EntryRecord>;
}

interface RemoveDeletedEntryRecordInput {
  readonly entryId: string;
  readonly generation: number;
  readonly records: Map<string, EntryRecord>;
}

const { applyRetention } = cmsSupport,
  { assertLiveEntry, assertReferenceDeletionAllowed, assertWriteToken } = entryOperationSupport,
  prepareDeleteEntry = (
    context: Readonly<CmsServiceOperationContext>,
    snapshot: CompiledSnapshot,
    input: DeleteEntryInput,
  ): Effect.Effect<PreparedDeleteEntry, CmsError> =>
    Effect.gen(function* prepareDeleteEntryEffect() {
      const contentType = snapshot.contentTypes.get(input.contentTypeId),
        current = yield* assertLiveEntry(
          (yield* context.persistence.readGeneration()).records.get(input.entryId),
          input.contentTypeId,
          input.entryId,
        ),
        deleteGeneration = yield* context.persistence.readGeneration();
      if (contentType === undefined) {
        return yield* NotFound.make({ message: `Entry ${input.entryId} was not found` });
      }
      yield* assertWriteToken(contentType, current, input.writeToken);
      yield* assertReferenceDeletionAllowed(snapshot, deleteGeneration, input.entryId);
      return {
        contentType,
        current,
        generation: deleteGeneration,
        records: new Map(deleteGeneration.records),
      };
    }),
  recordDeletedEntry = (
    context: Readonly<CmsServiceOperationContext>,
    prepared: PreparedDeleteEntry,
    input: DeleteEntryInput,
  ): Effect.Effect<DeletionRecord, CmsError> =>
    Effect.gen(function* recordDeletedEntryEffect() {
      const deletedAt = DateTime.formatIso(yield* DateTime.now),
        deletionRecord: DeletionRecord = {
          contentTypeId: input.contentTypeId,
          deletedAt,
          entryId: input.entryId,
          latestRevisionNumber: prepared.current.revisions.at(-1)?.revisionNumber ?? 0,
          writeToken: yield* context.identifiers.generate("write-token"),
        },
        now = yield* Clock.currentTimeMillis,
        { writeToken } = deletionRecord;
      prepared.records.set(input.entryId, {
        ...prepared.current,
        deletionRecord,
        revisions: applyRetention(prepared.current.revisions, prepared.contentType, now),
        writeToken,
      });
      yield* context.persistence.commitGeneration(prepared.generation.generation, prepared.records);
      return deletionRecord;
    }),
  removeDeletedEntryRecord = (
    context: Readonly<CmsServiceOperationContext>,
    input: RemoveDeletedEntryRecordInput,
  ): Effect.Effect<void, CmsError> =>
    Effect.gen(function* removeDeletedEntryRecordEffect() {
      input.records.delete(input.entryId);
      yield* context.persistence.commitGeneration(input.generation, input.records);
    });

export default {
  prepareDeleteEntry,
  recordDeletedEntry,
  removeDeletedEntryRecord,
};
export type { PreparedDeleteEntry, RemoveDeletedEntryRecordInput };
