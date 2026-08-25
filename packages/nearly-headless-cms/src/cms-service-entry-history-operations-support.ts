import { Clock, DateTime, Effect } from "effect";
import {
  type CmsError,
  InvalidInput,
  NotFound,
} from "./cms-error.ts";
import type { CompiledContentType, CompiledSnapshot } from "./content-definition.ts";
import type {
  CurrentState,
  ListRevisionsInput,
  RestoreInput,
  Revision,
  RevisionPage,
} from "./entry-history.ts";
import type { EntryGeneration, EntryRecord } from "./persistence.ts";
import type { ReadInput, Representation } from "./entry.ts";
import type { CmsServiceOperationContext } from "./cms-service-operation-context.ts";
import type { ReadRevisionInput } from "./cms-types.ts";
import { cloneJson } from "./internal/json.ts";
import cmsSupport from "./cms-support.ts";
import entryHistoryGuards from "./cms-service-entry-history-guards.ts";
import entryHistoryPurgeSupport from "./cms-service-entry-history-purge-support.ts";
import entryHistorySupport from "./cms-service-entry-history-support.ts";

interface CommitRestoredRevisionInput {
  readonly contentType: CompiledContentType;
  readonly current: EntryRecord;
  readonly entry: Representation;
  readonly entryId: string;
  readonly generation: EntryGeneration;
  readonly restoredFromRevisionNumber: number;
  readonly snapshot: CompiledSnapshot;
  readonly values: Representation["values"];
}

interface PrepareRestoredValuesInput {
  readonly contentType: CompiledContentType;
  readonly contentTypeId: string;
  readonly entryId: string;
  readonly generation: EntryGeneration;
  readonly snapshot: CompiledSnapshot;
  readonly sourceRevision: Revision;
}

interface PreparedRestoreEntryRevision {
  readonly entry: Representation;
  readonly generation: EntryGeneration;
  readonly restorable: { readonly contentType: CompiledContentType; readonly current: EntryRecord };
  readonly snapshot: CompiledSnapshot;
  readonly values: Representation["values"];
}

interface RestoreRevisionState {
  readonly generation: EntryGeneration;
  readonly snapshot: CompiledSnapshot;
}

const commitRestoredRevision = (
    context: CmsServiceOperationContext,
    input: CommitRestoredRevisionInput,
  ): Effect.Effect<CurrentState, CmsError> =>
    Effect.gen(function* commitRestoredRevisionEffect() {
      const now = yield* Clock.currentTimeMillis,
        revision: Revision = {
          definitionSnapshotId: input.snapshot.snapshotId,
          recordedAt: DateTime.formatIso(yield* DateTime.now),
          restoredFromRevisionNumber: input.restoredFromRevisionNumber,
          revisionNumber: (input.current.revisions.at(-1)?.revisionNumber ?? 0) + 1,
          values: cloneJson(input.values),
        },
        {revisionNumber} = revision,
        writeToken = yield* context.identifiers.generate("write-token");
      yield* context.persistence.commitGeneration(
        input.generation.generation,
        new Map([
          ...input.generation.records,
          [
            input.entryId,
            {
              entry: input.entry,
              revisions: applyRetention([...input.current.revisions, revision], input.contentType, now),
              writeToken,
            },
          ],
        ]),
      );
      return { entry: input.entry, revisionNumber, writeToken };
    }),
  maximumHistoryPageSize = 100,
  prepareRestoreEntryRevision = (
    context: CmsServiceOperationContext,
    input: RestoreInput,
  ): Effect.Effect<PreparedRestoreEntryRevision, CmsError> =>
    Effect.gen(function* prepareRestoreEntryRevisionEffect() {
      const generationSnapshot: RestoreRevisionState = {
          generation: yield* context.persistence.readGeneration(),
          snapshot: yield* authorizeHistoryEntry(context, {
            action: "entry.history.restore",
            contentTypeId: input.contentTypeId,
            entryId: input.entryId,
          }),
        },
        restorable = yield* assertRestorableEntry(
          generationSnapshot.snapshot.contentTypes.get(input.contentTypeId),
          generationSnapshot.generation.records.get(input.entryId),
          input,
        ),
        sourceRevision = yield* findSourceRevision(restorable.current, input.revisionNumber),
        values = yield* prepareRestoredValues(context, {
          contentType: restorable.contentType,
          contentTypeId: input.contentTypeId,
          entryId: input.entryId,
          generation: generationSnapshot.generation,
          snapshot: generationSnapshot.snapshot,
          sourceRevision,
        });
      return {
        entry: {
          contentTypeId: input.contentTypeId,
          id: input.entryId,
          values,
        },
        generation: generationSnapshot.generation,
        restorable,
        snapshot: generationSnapshot.snapshot,
        values,
      };
    }),
  prepareRestoredValues = (
    context: CmsServiceOperationContext,
    input: PrepareRestoredValuesInput,
  ): Effect.Effect<Representation["values"], CmsError> =>
    Effect.gen(function* prepareRestoredValuesEffect() {
      const sourceValues = yield* migrateRevisionValues(context, {
          contentTypeId: input.contentTypeId,
          entryId: input.entryId,
          generation: input.generation,
          snapshot: input.snapshot,
          sourceRevision: input.sourceRevision,
        }),
        values = yield* attempt(() =>
          input.snapshot.validateEntry(input.contentTypeId, sourceValues, { applyDefaults: false }),
        );
      yield* attempt(() => {
        ensureUniqueValues({
          contentType: input.contentType,
          ignoredEntryId: input.entryId,
          records: input.generation.records.values(),
          values,
        });
      });
      yield* ensureReferences(
        yield* attempt(() => collectReferences(input.contentType, values)),
        input.generation,
        context.assets,
      );
      return values;
    }),
  runGetCurrentEntryState = (
    context: CmsServiceOperationContext,
    input: Pick<ReadInput, "contentTypeId" | "entryId">,
  ): Effect.Effect<CurrentState, CmsError> =>
    Effect.gen(function* runGetCurrentEntryStateEffect() {
      yield* authorizeHistoryEntry(context, {
        action: "entry.history.read",
        contentTypeId: input.contentTypeId,
        entryId: input.entryId,
      });
      const generation = yield* context.persistence.readGeneration(),
        historyEntry = yield* assertHistoryEnabledEntry(
          generation.records.get(input.entryId),
          input.contentTypeId,
          input.entryId,
        ),
        latestRevision = historyEntry.record.revisions.at(-1);
      if (latestRevision === undefined) {
        return yield* NotFound.make({
          message: `History-enabled Entry ${input.entryId} has no revisions`,
        });
      }
      return {
        entry: structuredClone(historyEntry.record.entry),
        revisionNumber: latestRevision.revisionNumber,
        writeToken: historyEntry.writeToken,
      };
    }),
  runInspectEntryRevision = (
    context: CmsServiceOperationContext,
    input: ReadRevisionInput,
  ): Effect.Effect<Revision, CmsError> =>
    Effect.gen(function* runInspectEntryRevisionEffect() {
      yield* authorizeHistoryEntry(context, {
        action: "entry.history.read",
        contentTypeId: input.contentTypeId,
        entryId: input.entryId,
      });
      const generation = yield* context.persistence.readGeneration(),
        record = generation.records.get(input.entryId),
        revision = record?.revisions.find(
          (candidate) => candidate.revisionNumber === input.revisionNumber,
        );
      if (
        record === undefined ||
        record.entry.contentTypeId !== input.contentTypeId ||
        revision === undefined
      ) {
        return yield* NotFound.make({
          message: `Entry Revision ${input.revisionNumber} was not found`,
        });
      }
      return structuredClone(revision);
    }),
  runListEntryRevisions = (
    context: CmsServiceOperationContext,
    input: ListRevisionsInput,
  ): Effect.Effect<RevisionPage, CmsError> =>
    Effect.gen(function* runListEntryRevisionsEffect() {
      yield* authorizeHistoryEntry(context, {
        action: "entry.history.read",
        contentTypeId: input.contentTypeId,
        entryId: input.entryId,
      });
      if (
        !Number.isSafeInteger(input.pageSize) ||
        input.pageSize <= 0 ||
        input.pageSize > maximumHistoryPageSize
      ) {
        return yield* InvalidInput.make({
          message: `History pageSize must be between 1 and ${maximumHistoryPageSize}`,
        });
      }
      const generation = yield* context.persistence.readGeneration(),
        record = generation.records.get(input.entryId);
      if (
        record === undefined ||
        record.entry.contentTypeId !== input.contentTypeId ||
        record.revisions.length === 0
      ) {
        return yield* NotFound.make({
          message: `Entry History ${input.entryId} was not found`,
        });
      }
      return yield* buildRevisionPage({
        cursor: input.cursor,
        entryId: input.entryId,
        pageSize: input.pageSize,
        revisions: record.revisions,
      });
    }),
  runRestoreEntryRevision = (
    context: CmsServiceOperationContext,
    input: RestoreInput,
  ): Effect.Effect<CurrentState, CmsError> =>
    Effect.gen(function* runRestoreEntryRevisionEffect() {
      const prepared = yield* prepareRestoreEntryRevision(context, input);
      return yield* commitRestoredRevision(context, {
        contentType: prepared.restorable.contentType,
        current: prepared.restorable.current,
        entry: prepared.entry,
        entryId: input.entryId,
        generation: prepared.generation,
        restoredFromRevisionNumber: input.revisionNumber,
        snapshot: prepared.snapshot,
        values: prepared.values,
      });
    }),
  { applyRetention, attempt, collectReferences, ensureReferences, ensureUniqueValues } =
    cmsSupport,
  {
    assertHistoryEnabledEntry,
    assertRestorableEntry,
    authorizeHistoryEntry,
    buildRevisionPage,
    findSourceRevision,
  } = entryHistoryGuards,
  { migrateRevisionValues } = entryHistorySupport,
  { runPermanentlyPurgeEntry } = entryHistoryPurgeSupport;

export default {
  runGetCurrentEntryState,
  runInspectEntryRevision,
  runListEntryRevisions,
  runPermanentlyPurgeEntry,
  runRestoreEntryRevision,
};
