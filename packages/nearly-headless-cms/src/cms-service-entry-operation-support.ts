import { Clock, DateTime, Effect } from "effect";
import { type CmsError, Conflict, NotFound, ReferenceBlockedDeletion } from "./cms-error.ts";
import type {
  CmsServiceOperationContext,
  CompiledContentType,
  CompiledSnapshot,
  EntryGeneration,
  EntryRecord,
  MutationResult,
  Representation,
  Revision,
} from "./cms-service-entry-operation-types.ts";
import { cloneJson } from "./internal/json.ts";
import cmsSupport from "./cms-support.ts";

interface CommitEntryWithoutHistoryInput {
  readonly context: Readonly<CmsServiceOperationContext>;
  readonly entry: Representation;
  readonly generation: number;
  readonly records: Map<string, EntryRecord>;
}

interface HistoryCommitInput {
  readonly contentType: CompiledContentType;
  readonly currentRevisions: readonly Revision[];
  readonly entry: Representation;
  readonly entryId: string;
  readonly generation: number;
  readonly records: Map<string, EntryRecord>;
  readonly snapshotId: string;
  readonly values: Representation["values"];
}

const { applyRetention, attempt, collectReferences, liveRecords } = cmsSupport,
  assertLiveEntry = (
    record: EntryRecord | undefined,
    contentTypeId: string,
    entryId: string,
  ): Effect.Effect<EntryRecord, CmsError> => {
    if (
      record === undefined ||
      record.deletionRecord !== undefined ||
      record.entry.contentTypeId !== contentTypeId
    ) {
      return NotFound.make({ message: `Entry ${entryId} was not found` });
    }
    return Effect.succeed(record);
  },
  assertReferenceDeletionAllowed = (
    snapshot: CompiledSnapshot,
    generation: EntryGeneration,
    entryId: string,
  ): Effect.Effect<void, CmsError> =>
    Effect.gen(function* assertReferenceDeletionAllowedEffect() {
      for (const candidate of liveRecords(generation)) {
        const candidateContentType = snapshot.contentTypes.get(candidate.entry.contentTypeId);
        if (candidateContentType !== undefined) {
          const references = yield* attempt(() =>
            collectReferences(candidateContentType, candidate.entry.values),
          );
          if (references.relationships.some((reference) => reference.entryId === entryId)) {
            return yield* ReferenceBlockedDeletion.make({
              message: "Entry deletion is blocked by a live reference",
            });
          }
        }
      }
      return yield* Effect.void;
    }),
  assertWriteToken = (
    contentType: CompiledContentType,
    current: EntryRecord,
    writeToken: string | undefined,
  ): Effect.Effect<void, CmsError> => {
    if (contentType.definition.history === true && current.writeToken !== writeToken) {
      return Conflict.make({ message: "Write Token is stale" });
    }
    return Effect.void;
  },
  commitEntryWithHistory = (
    context: Readonly<CmsServiceOperationContext>,
    input: HistoryCommitInput,
  ): Effect.Effect<MutationResult, CmsError> =>
    Effect.gen(function* commitWithHistory() {
      const now = yield* Clock.currentTimeMillis,
        revision: Revision = {
          definitionSnapshotId: input.snapshotId,
          recordedAt: DateTime.formatIso(yield* DateTime.now),
          revisionNumber: (input.currentRevisions.at(-1)?.revisionNumber ?? 0) + 1,
          values: cloneJson(input.values),
        },
        writeToken = yield* context.identifiers.generate("write-token");
      input.records.set(input.entryId, {
        entry: input.entry,
        revisions: applyRetention([...input.currentRevisions, revision], input.contentType, now),
        writeToken,
      });
      yield* context.persistence.commitGeneration(input.generation, input.records);
      return { entry: input.entry, revisionNumber: revision.revisionNumber, writeToken };
    }),
  commitEntryWithoutHistory = ({
    context,
    entry,
    generation,
    records,
  }: Readonly<CommitEntryWithoutHistoryInput>): Effect.Effect<Representation, CmsError> =>
    Effect.gen(function* commitWithoutHistory() {
      records.set(entry.id, { entry, revisions: [] });
      yield* context.persistence.commitGeneration(generation, records);
      return entry;
    });

export default {
  assertLiveEntry,
  assertReferenceDeletionAllowed,
  assertWriteToken,
  commitEntryWithHistory,
  commitEntryWithoutHistory,
};
