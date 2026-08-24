import { Clock, DateTime, Effect } from "effect";
import {
  type CmsError,
  InvalidInput,
  NotFound,
} from "./cms-error.ts";
import type { CreateInput, ReadInput, Representation, UpdateInput } from "./entry.ts";
import type { DeletionRecord, Revision } from "./entry-history.ts";
import { type Query, type QueryPage, evaluate as evaluateQuery } from "./entry-query.ts";
import { cloneJson } from "./internal/json.ts";
import cmsSupport from "./cms-support.ts";
import type { CmsServiceOperationContext } from "./cms-service-operation-context.ts";
import entryOperationSupport from "./cms-service-entry-operation-support.ts";
import type { DeleteEntryInput, DeleteResult, MutationResult } from "./cms-types.ts";

const {
    applyRetention,
    attempt,
    collectReferences,
    ensureReferences,
    ensureUniqueValues,
    entryResource,
    expandRepresentation,
    liveRecords,
    project,
  } = cmsSupport,
  {
    assertLiveEntry,
    assertReferenceDeletionAllowed,
    assertWriteToken,
    commitEntryWithHistory,
    commitEntryWithoutHistory,
  } = entryOperationSupport,
  createEntryOperation =
    (context: CmsServiceOperationContext) =>
    (input: CreateInput): Effect.Effect<MutationResult, CmsError> =>
      Effect.gen(function* createEntryOperationEffect() {
        const snapshot = yield* context.currentDefinitionSnapshot;
        yield* context.authorize("entry.create", entryResource(snapshot, input.contentTypeId));
        const contentType = snapshot.contentTypes.get(input.contentTypeId);
        if (contentType === undefined) {
          return yield* InvalidInput.make({
            message: `Unknown Content Type ${input.contentTypeId}`,
          });
        }
        const generation = yield* context.persistence.readGeneration,
          values = yield* attempt(() =>
            snapshot.validateEntry(input.contentTypeId, input.values, { applyDefaults: true }),
          );
        yield* attempt(() => {
          ensureUniqueValues({ contentType, records: generation.records.values(), values });
        });
        yield* ensureReferences(
          yield* attempt(() => collectReferences(contentType, values)),
          generation,
          context.assets,
        );
        const entryId = yield* context.identifiers.generate("entry"),
          entry: Representation = { contentTypeId: input.contentTypeId, id: entryId, values },
          records = new Map(generation.records);
        if (contentType.definition.history !== true) {
          return yield* commitEntryWithoutHistory(
            context,
            entry,
            entryId,
            generation.generation,
            records,
          );
        }
        const revision: Revision = {
            definitionSnapshotId: snapshot.snapshotId,
            recordedAt: DateTime.formatIso(yield* DateTime.now),
            revisionNumber: 1,
            values: cloneJson(values),
          },
          writeToken = yield* context.identifiers.generate("write-token");
        records.set(entryId, { entry, revisions: [revision], writeToken });
        yield* context.persistence.commitGeneration(generation.generation, records);
        return { entry, revisionNumber: 1, writeToken };
      }),
  deleteEntryOperation =
    (context: CmsServiceOperationContext) =>
    (input: DeleteEntryInput): Effect.Effect<DeleteResult, CmsError> =>
      Effect.gen(function* deleteEntryOperationEffect() {
        const snapshot = yield* context.currentDefinitionSnapshot;
        yield* context.authorize(
          "entry.delete",
          entryResource(snapshot, input.contentTypeId, input.entryId),
        );
        const contentType = snapshot.contentTypes.get(input.contentTypeId),
          generation = yield* context.persistence.readGeneration,
          current = yield* assertLiveEntry(
            generation.records.get(input.entryId),
            input.contentTypeId,
            input.entryId,
          );
        if (contentType === undefined) {
          return yield* NotFound.make({ message: `Entry ${input.entryId} was not found` });
        }
        yield* assertWriteToken(contentType, current, input.writeToken);
        yield* assertReferenceDeletionAllowed(snapshot, generation, input.entryId);
        const records = new Map(generation.records);
        if (contentType.definition.history !== true) {
          records.delete(input.entryId);
          yield* context.persistence.commitGeneration(generation.generation, records);
          return;
        }
        const deletedAt = DateTime.formatIso(yield* DateTime.now),
          now = yield* Clock.currentTimeMillis,
          writeToken = yield* context.identifiers.generate("write-token"),
          deletionRecord: DeletionRecord = {
            contentTypeId: input.contentTypeId,
            deletedAt,
            entryId: input.entryId,
            latestRevisionNumber: current.revisions.at(-1)?.revisionNumber ?? 0,
            writeToken,
          };
        records.set(input.entryId, {
          ...current,
          deletionRecord,
          revisions: applyRetention(current.revisions, contentType, now),
          writeToken,
        });
        yield* context.persistence.commitGeneration(generation.generation, records);
        return deletionRecord;
      }),
  getEntryOperation =
    (context: CmsServiceOperationContext) =>
    (input: ReadInput): Effect.Effect<Representation, CmsError> =>
      Effect.gen(function* getEntryOperationEffect() {
        const snapshot = yield* context.currentDefinitionSnapshot;
        yield* context.authorize(
          "entry.read",
          entryResource(snapshot, input.contentTypeId, input.entryId),
        );
        if (input.expansion !== undefined && input.expansion.length > 0) {
          yield* context.authorize(
            "entry.expand",
            entryResource(snapshot, input.contentTypeId, input.entryId),
          );
        }
        const generation = yield* context.persistence.readGeneration,
          record = yield* assertLiveEntry(
            generation.records.get(input.entryId),
            input.contentTypeId,
            input.entryId,
          );
        return project(
          yield* attempt(() =>
            expandRepresentation({
              entry: record.entry,
              expansion: input.expansion,
              generation,
              snapshot,
            }),
          ),
          input.projection,
        );
      }),
  queryEntriesOperation =
    (context: CmsServiceOperationContext) =>
    (query: Query): Effect.Effect<QueryPage, CmsError> =>
      Effect.gen(function* queryEntriesOperationEffect() {
        const snapshot = yield* context.currentDefinitionSnapshot;
        yield* context.authorize("entry.query", {
          contentTypeId: query.contentTypeId,
          definitionSpaceId: snapshot.definitionSpaceId,
          kind: "contentType",
        });
        if (query.expansion !== undefined && query.expansion.length > 0) {
          yield* context.authorize("entry.expand", {
            contentTypeId: query.contentTypeId,
            definitionSpaceId: snapshot.definitionSpaceId,
            kind: "contentType",
          });
        }
        const generation = yield* context.persistence.readGeneration,
          page = yield* attempt(() =>
            evaluateQuery({
              entries: liveRecords(generation).map((record) => record.entry),
              options: { generation: generation.generation },
              query,
              snapshot,
            }),
          );
        if (query.expansion === undefined || query.expansion.length === 0) {
          return page;
        }
        const items = yield* attempt(() =>
          page.items.map((entry) =>
            expandRepresentation({
              entry,
              expansion: query.expansion,
              generation,
              snapshot,
            }),
          ),
        );
        if (page.nextCursor === undefined) {
          return { items };
        }
        return { items, nextCursor: page.nextCursor };
      }),
  updateEntryOperation =
    (context: CmsServiceOperationContext) =>
    (input: UpdateInput): Effect.Effect<MutationResult, CmsError> =>
      Effect.gen(function* updateEntryOperationEffect() {
        const snapshot = yield* context.currentDefinitionSnapshot;
        yield* context.authorize(
          "entry.update",
          entryResource(snapshot, input.contentTypeId, input.entryId),
        );
        const contentType = snapshot.contentTypes.get(input.contentTypeId);
        if (contentType === undefined) {
          return yield* InvalidInput.make({
            message: `Unknown Content Type ${input.contentTypeId}`,
          });
        }
        const generation = yield* context.persistence.readGeneration,
          current = yield* assertLiveEntry(
            generation.records.get(input.entryId),
            input.contentTypeId,
            input.entryId,
          );
        yield* assertWriteToken(contentType, current, input.writeToken);
        const entry: Representation = {
            contentTypeId: input.contentTypeId,
            id: input.entryId,
            values: yield* attempt(() =>
              snapshot.validateEntry(input.contentTypeId, input.values, { applyDefaults: false }),
            ),
          },
          records = new Map(generation.records);
        yield* attempt(() => {
          ensureUniqueValues({
            contentType,
            ignoredEntryId: input.entryId,
            records: generation.records.values(),
            values: entry.values,
          });
        });
        yield* ensureReferences(
          yield* attempt(() => collectReferences(contentType, entry.values)),
          generation,
          context.assets,
        );
        if (contentType.definition.history !== true) {
          return yield* commitEntryWithoutHistory(
            context,
            entry,
            input.entryId,
            generation.generation,
            records,
          );
        }
        return yield* commitEntryWithHistory(context, {
          contentType,
          currentRevisions: current.revisions,
          entry,
          entryId: input.entryId,
          generation: generation.generation,
          records,
          snapshotId: snapshot.snapshotId,
          values: entry.values,
        });
      });

export default {
  createEntry: createEntryOperation,
  deleteEntry: deleteEntryOperation,
  getEntry: getEntryOperation,
  queryEntries: queryEntriesOperation,
  updateEntry: updateEntryOperation,
};
