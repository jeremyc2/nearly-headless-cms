import { Clock, DateTime, Effect } from "effect";
import { type CmsError, ReferenceBlockedDeletion } from "./cms-error.ts";
import type { CompiledContentType, CompiledSnapshot } from "./content-definition.ts";
import type { DeletionRecord, Revision } from "./entry-history.ts";
import type { EntryBatchMutation, EntryBatchMutationResult, MutationResult } from "./cms-types.ts";
import type { EntryGeneration, EntryRecord } from "./persistence.ts";
import type { CmsServiceOperationContext } from "./cms-service-operation-context.ts";
import type { Representation } from "./entry.ts";
import batchValidateSupport from "./cms-service-entry-batch-operations-validate-support.ts";
import { cloneJson } from "./internal/json.ts";
import cmsSupport from "./cms-support.ts";

interface BatchMutationInput {
  readonly contentType: CompiledContentType;
  readonly current: EntryRecord;
  readonly entryId: string;
  readonly generation: EntryGeneration;
  readonly mutation: EntryBatchMutation;
  readonly records: Map<string, EntryRecord>;
  readonly snapshot: CompiledSnapshot;
}

interface BatchReplaceWithHistoryInput {
  readonly contentType: CompiledContentType;
  readonly current: EntryRecord;
  readonly entry: Representation;
  readonly entryId: string;
  readonly records: Map<string, EntryRecord>;
  readonly snapshot: CompiledSnapshot;
  readonly values: Representation["values"];
}

const { applyRetention, attempt, collectReferences, entryResource } = cmsSupport,
  { validateBatchReplaceValues } = batchValidateSupport,
  applyBatchDeleteMutation = (
    context: Readonly<CmsServiceOperationContext>,
    input: BatchMutationInput & {
      readonly mutation: Extract<EntryBatchMutation, { kind: "delete" }>;
    },
  ): Effect.Effect<EntryBatchMutationResult, CmsError> => {
    const { contentType, current, entryId, records, snapshot } = input;
    if (contentType.definition.history !== true) {
      return Effect.gen(function* applyBatchDeleteWithoutHistoryEffect() {
        yield* assertBatchReferenceDeletionAllowed(records, snapshot, entryId);
        records.delete(entryId);
      });
    }
    return Effect.gen(function* applyBatchDeleteWithHistoryEffect() {
      yield* assertBatchReferenceDeletionAllowed(records, snapshot, entryId);
      return yield* recordBatchDeletedEntry(context, {
        contentType,
        contentTypeId: input.mutation.input.contentTypeId,
        current,
        entryId,
        records,
      });
    });
  },
  applyBatchReplaceMutation = (
    context: Readonly<CmsServiceOperationContext>,
    input: BatchMutationInput & {
      readonly mutation: Extract<EntryBatchMutation, { kind: "replace" }>;
    },
  ): Effect.Effect<EntryBatchMutationResult, CmsError> =>
    Effect.gen(function* applyBatchReplaceEffect() {
      const { contentType, current, entryId, mutation, records, snapshot } = input,
        values = yield* validateBatchReplaceValues({
          contentType,
          context,
          entryId,
          generation: input.generation,
          mutation,
          records,
          snapshot,
        });
      if (contentType.definition.history !== true) {
        records.set(entryId, {
          entry: {
            contentTypeId: mutation.input.contentTypeId,
            id: entryId,
            values,
          },
          revisions: [],
        });
        return {
          contentTypeId: mutation.input.contentTypeId,
          id: entryId,
          values,
        };
      }
      return yield* commitBatchReplaceWithHistory(context, {
        contentType,
        current,
        entry: {
          contentTypeId: mutation.input.contentTypeId,
          id: entryId,
          values,
        },
        entryId,
        records,
        snapshot,
        values,
      });
    }),
  assertBatchReferenceDeletionAllowed = (
    records: Map<string, EntryRecord>,
    snapshot: CompiledSnapshot,
    entryId: string,
  ): Effect.Effect<void, CmsError> =>
    Effect.gen(function* assertBatchReferenceDeletionAllowedEffect() {
      for (const candidate of liveBatchRecords(records, entryId)) {
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
  authorizeBatchMutation = (
    context: Readonly<CmsServiceOperationContext>,
    snapshot: CompiledSnapshot,
    mutation: EntryBatchMutation,
  ): Effect.Effect<void, CmsError> =>
    Effect.gen(function* authorizeBatchMutationEffect() {
      const { input } = mutation;
      if (mutation.kind === "replace") {
        yield* context.authorize(
          "entry.update",
          entryResource(snapshot, input.contentTypeId, input.entryId),
        );
        return;
      }
      yield* context.authorize(
        "entry.delete",
        entryResource(snapshot, input.contentTypeId, input.entryId),
      );
    }),
  commitBatchReplaceWithHistory = (
    context: Readonly<CmsServiceOperationContext>,
    input: BatchReplaceWithHistoryInput,
  ): Effect.Effect<MutationResult, CmsError> =>
    Effect.gen(function* commitBatchReplaceWithHistoryEffect() {
      const now = yield* Clock.currentTimeMillis,
        revision: Revision = {
          definitionSnapshotId: input.snapshot.snapshotId,
          recordedAt: DateTime.formatIso(yield* DateTime.now),
          revisionNumber: (input.current.revisions.at(-1)?.revisionNumber ?? 0) + 1,
          values: cloneJson(input.values),
        },
        writeToken = yield* context.identifiers.generate("write-token");
      input.records.set(input.entryId, {
        entry: input.entry,
        revisions: applyRetention([...input.current.revisions, revision], input.contentType, now),
        writeToken,
      });
      return { entry: input.entry, revisionNumber: revision.revisionNumber, writeToken };
    }),
  liveBatchRecords = (
    records: Map<string, EntryRecord>,
    excludedEntryId: string,
  ): readonly EntryRecord[] =>
    [...records.values()].filter(
      (record) => record.deletionRecord === undefined && record.entry.id !== excludedEntryId,
    ),
  processBatchMutation = (
    context: Readonly<CmsServiceOperationContext>,
    batchInput: BatchMutationInput,
  ): Effect.Effect<EntryBatchMutationResult, CmsError> => {
    if (batchInput.mutation.kind === "replace") {
      return applyBatchReplaceMutation(context, {
        ...batchInput,
        mutation: batchInput.mutation,
      });
    }
    return applyBatchDeleteMutation(context, {
      ...batchInput,
      mutation: batchInput.mutation,
    });
  },
  recordBatchDeletedEntry = (
    context: Readonly<CmsServiceOperationContext>,
    input: {
      readonly contentType: CompiledContentType;
      readonly contentTypeId: string;
      readonly current: EntryRecord;
      readonly entryId: string;
      readonly records: Map<string, EntryRecord>;
    },
  ): Effect.Effect<DeletionRecord, CmsError> =>
    Effect.gen(function* recordBatchDeletedEntryEffect() {
      const deletedAt = DateTime.formatIso(yield* DateTime.now),
        deletionRecord: DeletionRecord = {
          contentTypeId: input.contentTypeId,
          deletedAt,
          entryId: input.entryId,
          latestRevisionNumber: input.current.revisions.at(-1)?.revisionNumber ?? 0,
          writeToken: yield* context.identifiers.generate("write-token"),
        },
        now = yield* Clock.currentTimeMillis;
      input.records.set(input.entryId, {
        ...input.current,
        deletionRecord,
        revisions: applyRetention(input.current.revisions, input.contentType, now),
        writeToken: deletionRecord.writeToken,
      });
      return deletionRecord;
    });

export default {
  authorizeBatchMutation,
  processBatchMutation,
};
export type { BatchMutationInput };
