import { Clock, DateTime, Effect } from "effect";
import {
  type CmsError,
  InvalidInput,
  NotFound,
  ReferenceBlockedDeletion,
} from "./cms-error.ts";
import type { CompiledContentType, CompiledSnapshot } from "./content-definition.ts";
import type { Representation } from "./entry.ts";
import type { DeletionRecord, Revision } from "./entry-history.ts";
import { cloneJson } from "./internal/json.ts";
import type { EntryGeneration, EntryRecord } from "./persistence.ts";
import cmsSupport from "./cms-support.ts";
import type { CmsServiceOperationContext } from "./cms-service-operation-context.ts";
import entryOperationSupport from "./cms-service-entry-operation-support.ts";
import type { EntryBatchMutation, EntryBatchMutationResult } from "./cms-types.ts";

const { applyRetention, attempt, collectReferences, ensureReferences, ensureUniqueValues, entryResource } =
    cmsSupport,
  { assertLiveEntry, assertWriteToken } = entryOperationSupport;

interface BatchMutationInput {
  readonly contentType: CompiledContentType;
  readonly current: EntryRecord;
  readonly entryId: string;
  readonly generation: EntryGeneration;
  readonly mutation: EntryBatchMutation;
  readonly records: Map<string, EntryRecord>;
  readonly snapshot: CompiledSnapshot;
}

const applyBatchDeleteMutation = (
  context: CmsServiceOperationContext,
  input: BatchMutationInput & { readonly mutation: Extract<EntryBatchMutation, { kind: "delete" }> },
): Effect.Effect<EntryBatchMutationResult, CmsError> =>
  Effect.gen(function* applyBatchDelete() {
    const { contentType, current, entryId, records, snapshot } = input;
    for (const candidate of records.values()) {
      if (candidate.deletionRecord !== undefined || candidate.entry.id === entryId) {
        continue;
      }
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
    if (contentType.definition.history !== true) {
      records.delete(entryId);
      return;
    }
    const deletedAt = DateTime.formatIso(yield* DateTime.now),
      now = yield* Clock.currentTimeMillis,
      writeToken = yield* context.identifiers.generate("write-token"),
      deletionRecord: DeletionRecord = {
        contentTypeId: input.mutation.input.contentTypeId,
        deletedAt,
        entryId,
        latestRevisionNumber: current.revisions.at(-1)?.revisionNumber ?? 0,
        writeToken,
      };
    records.set(entryId, {
      ...current,
      deletionRecord,
      revisions: applyRetention(current.revisions, contentType, now),
      writeToken,
    });
    return deletionRecord;
  }),
  applyBatchReplaceMutation = (
    context: CmsServiceOperationContext,
    input: BatchMutationInput & { readonly mutation: Extract<EntryBatchMutation, { kind: "replace" }> },
  ): Effect.Effect<EntryBatchMutationResult, CmsError> =>
    Effect.gen(function* applyBatchReplace() {
      const { contentType, current, entryId, generation, mutation, records, snapshot } = input,
        values = yield* attempt(() =>
          snapshot.validateEntry(mutation.input.contentTypeId, mutation.input.values, {
            applyDefaults: false,
          }),
        );
      yield* attempt(() => {
        ensureUniqueValues({
          contentType,
          ignoredEntryId: entryId,
          records: records.values(),
          values,
        });
      });
      yield* ensureReferences(
        yield* attempt(() => collectReferences(contentType, values)),
        { generation: generation.generation, records },
        context.assets,
      );
      const entry: Representation = {
        contentTypeId: mutation.input.contentTypeId,
        id: entryId,
        values,
      };
      if (contentType.definition.history !== true) {
        records.set(entryId, { entry, revisions: [] });
        return entry;
      }
      const now = yield* Clock.currentTimeMillis,
        revisionNumber = (current.revisions.at(-1)?.revisionNumber ?? 0) + 1,
        writeToken = yield* context.identifiers.generate("write-token"),
        revision: Revision = {
          definitionSnapshotId: snapshot.snapshotId,
          recordedAt: DateTime.formatIso(yield* DateTime.now),
          revisionNumber,
          values: cloneJson(values),
        };
      records.set(entryId, {
        entry,
        revisions: applyRetention([...current.revisions, revision], contentType, now),
        writeToken,
      });
      return { entry, revisionNumber, writeToken };
    }),
  mutateEntriesAtomicallyOperation =
    (context: CmsServiceOperationContext) =>
    (mutations: readonly EntryBatchMutation[]): Effect.Effect<readonly EntryBatchMutationResult[], CmsError> =>
      Effect.gen(function* mutateEntryBatch() {
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
          const { input } = mutation,
            authorizationAction = mutation.kind === "replace" ? "entry.update" : "entry.delete",
            contentType = snapshot.contentTypes.get(input.contentTypeId),
            current = records.get(input.entryId),
            liveCurrent = yield* assertLiveEntry(current, input.contentTypeId, input.entryId);
          yield* context.authorize(
            authorizationAction,
            entryResource(snapshot, input.contentTypeId, input.entryId),
          );
          if (contentType === undefined) {
            return yield* NotFound.make({ message: `Entry ${input.entryId} was not found` });
          }
          yield* assertWriteToken(contentType, liveCurrent, input.writeToken);
          const batchInput: BatchMutationInput = {
            contentType,
            current: liveCurrent,
            entryId: input.entryId,
            generation,
            mutation,
            records,
            snapshot,
          };
          if (mutation.kind === "replace") {
            results.push(yield* applyBatchReplaceMutation(context, { ...batchInput, mutation }));
            continue;
          }
          results.push(yield* applyBatchDeleteMutation(context, { ...batchInput, mutation }));
        }
        yield* context.persistence.commitGeneration(generation.generation, records);
        return results;
      });

export default {
  mutateEntriesAtomically: mutateEntriesAtomicallyOperation,
};
