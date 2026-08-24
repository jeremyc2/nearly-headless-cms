import { Clock, DateTime, Effect } from "effect";
import {
  type CmsError,
  Conflict,
  NotFound,
  ReferenceBlockedDeletion,
} from "./cms-error.ts";
import type { CompiledContentType, CompiledSnapshot } from "./content-definition.ts";
import type { Representation } from "./entry.ts";
import type { Revision } from "./entry-history.ts";
import { cloneJson } from "./internal/json.ts";
import type { EntryGeneration, EntryRecord } from "./persistence.ts";
import cmsSupport from "./cms-support.ts";
import type { CmsServiceOperationContext } from "./cms-service-operation-context.ts";
import type { MutationResult } from "./cms-types.ts";

const { applyRetention, attempt, collectReferences, liveRecords } = cmsSupport;

export interface HistoryCommitInput {
  readonly contentType: CompiledContentType;
  readonly currentRevisions: readonly Revision[];
  readonly entry: Representation;
  readonly entryId: string;
  readonly generation: number;
  readonly records: Map<string, EntryRecord>;
  readonly snapshotId: string;
  readonly values: Representation["values"];
}

const assertLiveEntry = (
  record: EntryRecord | undefined,
  contentTypeId: string,
  entryId: string,
): Effect.Effect<EntryRecord, CmsError> => {
  if (
    record === undefined ||
    record.deletionRecord !== undefined ||
    record.entry.contentTypeId !== contentTypeId
  ) {
    return Effect.fail(NotFound.make({ message: `Entry ${entryId} was not found` }));
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
        if (candidateContentType === undefined) {
          continue;
        }
        const references = yield* attempt(() =>
          collectReferences(candidateContentType, candidate.entry.values),
        );
        if (references.relationships.some((reference) => reference.entryId === entryId)) {
          return yield* ReferenceBlockedDeletion.make({
            message: "Entry deletion is blocked by a live reference",
          });
        }
      }
    }),
  assertWriteToken = (
    contentType: CompiledContentType,
    current: EntryRecord,
    writeToken: string | undefined,
  ): Effect.Effect<void, CmsError> => {
    if (contentType.definition.history === true && current.writeToken !== writeToken) {
      return Effect.fail(Conflict.make({ message: "Write Token is stale" }));
    }
    return Effect.void;
  },
  commitEntryWithHistory = (
    context: CmsServiceOperationContext,
    input: HistoryCommitInput,
  ): Effect.Effect<MutationResult, CmsError> =>
    Effect.gen(function* commitWithHistory() {
      const now = yield* Clock.currentTimeMillis,
        revisionNumber = (input.currentRevisions.at(-1)?.revisionNumber ?? 0) + 1,
        writeToken = yield* context.identifiers.generate("write-token"),
        revision: Revision = {
          definitionSnapshotId: input.snapshotId,
          recordedAt: DateTime.formatIso(yield* DateTime.now),
          revisionNumber,
          values: cloneJson(input.values),
        };
      input.records.set(input.entryId, {
        entry: input.entry,
        revisions: applyRetention([...input.currentRevisions, revision], input.contentType, now),
        writeToken,
      });
      yield* context.persistence.commitGeneration(input.generation, input.records);
      return { entry: input.entry, revisionNumber, writeToken };
    }),
  commitEntryWithoutHistory = (
    context: CmsServiceOperationContext,
    entry: Representation,
    entryId: string,
    generation: number,
    records: Map<string, EntryRecord>,
  ): Effect.Effect<Representation, CmsError> =>
    Effect.gen(function* commitWithoutHistory() {
      records.set(entryId, { entry, revisions: [] });
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
