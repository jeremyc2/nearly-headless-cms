import { Clock, DateTime, Effect } from "effect";
import {
  type CmsError,
  Conflict,
  InvalidInput,
  NotFound,
} from "./cms-error.ts";
import type { ReadInput, Representation } from "./entry.ts";
import type {
  CurrentState,
  ListRevisionsInput,
  RestoreInput,
  Revision,
  RevisionPage,
} from "./entry-history.ts";
import { cloneJson } from "./internal/json.ts";
import cmsSupport from "./cms-support.ts";
import type { CmsServiceOperationContext } from "./cms-service-operation-context.ts";
import entryHistorySupport from "./cms-service-entry-history-support.ts";
import type { PurgeEntryInput, ReadRevisionInput } from "./cms-types.ts";

const { applyRetention, attempt, collectReferences, decodeHistoryCursor, ensureReferences, ensureUniqueValues, entryResource, historyCursor } =
    cmsSupport,
  { migrateRevisionValues } = entryHistorySupport,
  getCurrentEntryStateOperation =
    (context: CmsServiceOperationContext) =>
    (input: Pick<ReadInput, "contentTypeId" | "entryId">): Effect.Effect<CurrentState, CmsError> =>
      Effect.gen(function* getCurrentEntryStateOperationEffect() {
        const snapshot = yield* context.currentDefinitionSnapshot;
        yield* context.authorize(
          "entry.history.read",
          entryResource(snapshot, input.contentTypeId, input.entryId),
        );
        const generation = yield* context.persistence.readGeneration,
          record = generation.records.get(input.entryId);
        if (
          record === undefined ||
          record.deletionRecord !== undefined ||
          record.entry.contentTypeId !== input.contentTypeId ||
          record.writeToken === undefined ||
          record.revisions.length === 0
        ) {
          return yield* NotFound.make({
            message: `History-enabled Entry ${input.entryId} was not found`,
          });
        }
        const latestRevision = record.revisions.at(-1);
        if (latestRevision === undefined) {
          return yield* NotFound.make({
            message: `History-enabled Entry ${input.entryId} has no revisions`,
          });
        }
        return {
          entry: structuredClone(record.entry),
          revisionNumber: latestRevision.revisionNumber,
          writeToken: record.writeToken,
        };
      }),
  inspectEntryRevisionOperation =
    (context: CmsServiceOperationContext) =>
    (input: ReadRevisionInput): Effect.Effect<Revision, CmsError> =>
      Effect.gen(function* inspectEntryRevisionOperationEffect() {
        const snapshot = yield* context.currentDefinitionSnapshot;
        yield* context.authorize(
          "entry.history.read",
          entryResource(snapshot, input.contentTypeId, input.entryId),
        );
        const generation = yield* context.persistence.readGeneration,
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
  listEntryRevisionsOperation =
    (context: CmsServiceOperationContext) =>
    (input: ListRevisionsInput): Effect.Effect<RevisionPage, CmsError> =>
      Effect.gen(function* listEntryRevisionsOperationEffect() {
        const snapshot = yield* context.currentDefinitionSnapshot;
        yield* context.authorize(
          "entry.history.read",
          entryResource(snapshot, input.contentTypeId, input.entryId),
        );
        if (!Number.isSafeInteger(input.pageSize) || input.pageSize <= 0 || input.pageSize > 100) {
          return yield* InvalidInput.make({
            message: "History pageSize must be between 1 and 100",
          });
        }
        const generation = yield* context.persistence.readGeneration,
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
        const newestFirst = [...record.revisions].toReversed(),
          offset = yield* attempt(() => decodeHistoryCursor(input.cursor, input.entryId)),
          revisions = newestFirst.slice(offset, offset + input.pageSize),
          items = revisions.map(({ values: _values, ...metadata }) => metadata),
          nextOffset = offset + items.length;
        if (nextOffset < newestFirst.length) {
          return { items, nextCursor: historyCursor(nextOffset, input.entryId) };
        }
        return { items };
      }),
  permanentlyPurgeEntryOperation =
    (context: CmsServiceOperationContext) =>
    (input: PurgeEntryInput): Effect.Effect<void, CmsError> =>
      Effect.gen(function* permanentlyPurgeEntryOperationEffect() {
        const snapshot = yield* context.currentDefinitionSnapshot;
        yield* context.authorize(
          "entry.history.purge",
          entryResource(snapshot, input.contentTypeId, input.entryId),
        );
        const generation = yield* context.persistence.readGeneration,
          record = generation.records.get(input.entryId);
        if (
          record === undefined ||
          record.entry.contentTypeId !== input.contentTypeId ||
          record.deletionRecord === undefined
        ) {
          return yield* NotFound.make({
            message: `Deleted Entry ${input.entryId} was not found`,
          });
        }
        if (record.writeToken !== input.writeToken) {
          return yield* Conflict.make({ message: "Write Token is stale" });
        }
        const records = new Map(generation.records);
        records.delete(input.entryId);
        yield* context.persistence.commitGeneration(generation.generation, records);
        return yield* Effect.void;
      }),
  restoreEntryRevisionOperation =
    (context: CmsServiceOperationContext) =>
    (input: RestoreInput): Effect.Effect<CurrentState, CmsError> =>
      Effect.gen(function* restoreEntryRevisionOperationEffect() {
        const snapshot = yield* context.currentDefinitionSnapshot;
        yield* context.authorize(
          "entry.history.restore",
          entryResource(snapshot, input.contentTypeId, input.entryId),
        );
        const contentType = snapshot.contentTypes.get(input.contentTypeId),
          generation = yield* context.persistence.readGeneration,
          current = generation.records.get(input.entryId);
        if (
          contentType?.definition.history !== true ||
          current === undefined ||
          current.writeToken !== input.writeToken
        ) {
          if (current === undefined) {
            return yield* NotFound.make({
              message: `Entry History ${input.entryId} was not found`,
            });
          }
          return yield* Conflict.make({ message: "Write Token is stale" });
        }
        const sourceRevision = current.revisions.find(
          (revision) => revision.revisionNumber === input.revisionNumber,
        );
        if (sourceRevision === undefined) {
          return yield* NotFound.make({
            message: `Entry Revision ${input.revisionNumber} was not found`,
          });
        }
        const sourceValues = yield* migrateRevisionValues(context, {
            contentTypeId: input.contentTypeId,
            entryId: input.entryId,
            generation,
            snapshot,
            sourceRevision,
          }),
          values = yield* attempt(() =>
            snapshot.validateEntry(input.contentTypeId, sourceValues, { applyDefaults: false }),
          );
        yield* attempt(() => {
          ensureUniqueValues({
            contentType,
            ignoredEntryId: input.entryId,
            records: generation.records.values(),
            values,
          });
        });
        yield* ensureReferences(
          yield* attempt(() => collectReferences(contentType, values)),
          generation,
          context.assets,
        );
        const entry: Representation = {
            contentTypeId: input.contentTypeId,
            id: input.entryId,
            values,
          },
          now = yield* Clock.currentTimeMillis,
          revisionNumber = (current.revisions.at(-1)?.revisionNumber ?? 0) + 1,
          revision: Revision = {
            definitionSnapshotId: snapshot.snapshotId,
            recordedAt: DateTime.formatIso(yield* DateTime.now),
            restoredFromRevisionNumber: input.revisionNumber,
            revisionNumber,
            values: cloneJson(values),
          },
          writeToken = yield* context.identifiers.generate("write-token"),
          records = new Map(generation.records);
        records.set(input.entryId, {
          entry,
          revisions: applyRetention([...current.revisions, revision], contentType, now),
          writeToken,
        });
        yield* context.persistence.commitGeneration(generation.generation, records);
        return { entry, revisionNumber, writeToken };
      });

export default {
  getCurrentEntryState: getCurrentEntryStateOperation,
  inspectEntryRevision: inspectEntryRevisionOperation,
  listEntryRevisions: listEntryRevisionsOperation,
  permanentlyPurgeEntry: permanentlyPurgeEntryOperation,
  restoreEntryRevision: restoreEntryRevisionOperation,
};
