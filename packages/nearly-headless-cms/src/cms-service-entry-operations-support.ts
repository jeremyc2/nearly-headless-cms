import { Clock, DateTime, Effect } from "effect";
import {
  type CmsError,
  InvalidInput,
  NotFound,
} from "./cms-error.ts";
import type { CompiledContentType, CompiledSnapshot } from "./content-definition.ts";
import type { CreateInput, ReadInput, Representation, UpdateInput } from "./entry.ts";
import type { DeletionRecord, Revision } from "./entry-history.ts";
import { type Query, type QueryPage, evaluate as evaluateQuery } from "./entry-query.ts";
import { cloneJson } from "./internal/json.ts";
import type { EntryGeneration, EntryRecord } from "./persistence.ts";
import type { CmsServiceOperationContext } from "./cms-service-operation-context.ts";
import type { DeleteEntryInput, DeleteResult, MutationResult } from "./cms-types.ts";
import entryOperationSupport from "./cms-service-entry-operation-support.ts";
import cmsSupport from "./cms-support.ts";

const { applyRetention, attempt, collectReferences, ensureReferences, ensureUniqueValues, entryResource, expandRepresentation, liveRecords, project } =
    cmsSupport,
  {
    assertLiveEntry,
    assertReferenceDeletionAllowed,
    assertWriteToken,
    commitEntryWithHistory,
    commitEntryWithoutHistory,
  } = entryOperationSupport;

interface AuthorizeEntryExpansionInput {
  readonly contentTypeId: string;
  readonly entryId: string | undefined;
  readonly expansion: readonly string[] | undefined;
  readonly snapshot: CompiledSnapshot;
}

interface CommitCreatedEntryWithHistoryInput {
  readonly entry: Representation;
  readonly entryId: string;
  readonly generation: EntryGeneration;
  readonly records: Map<string, EntryRecord>;
  readonly snapshot: CompiledSnapshot;
  readonly values: Representation["values"];
}

interface ExpandQueryPageInput {
  readonly expansion: readonly string[] | undefined;
  readonly generation: EntryGeneration;
  readonly page: QueryPage;
  readonly snapshot: CompiledSnapshot;
}

interface PersistCreatedEntryInput {
  readonly input: CreateInput;
  readonly prepared: PreparedCreateEntry;
  readonly snapshot: CompiledSnapshot;
}

interface PreparedCreateEntry {
  readonly contentType: CompiledContentType;
  readonly generation: EntryGeneration;
  readonly values: Representation["values"];
}

interface PreparedDeleteEntry {
  readonly contentType: CompiledContentType;
  readonly current: EntryRecord;
  readonly generation: EntryGeneration;
  readonly records: Map<string, EntryRecord>;
}

interface PreparedUpdateEntry {
  readonly contentType: CompiledContentType;
  readonly current: EntryRecord;
  readonly entry: Representation;
  readonly generation: EntryGeneration;
  readonly records: Map<string, EntryRecord>;
  readonly snapshotId: string;
}

interface RemoveDeletedEntryRecordInput {
  readonly entryId: string;
  readonly generation: number;
  readonly records: Map<string, EntryRecord>;
}

const authorizeDeleteEntry = (
  context: CmsServiceOperationContext,
  input: DeleteEntryInput,
): Effect.Effect<CompiledSnapshot, CmsError> =>
  Effect.gen(function* authorizeDeleteEntryEffect() {
    const snapshot = yield* context.currentDefinitionSnapshot;
    yield* context.authorize(
      "entry.delete",
      entryResource(snapshot, input.contentTypeId, input.entryId),
    );
    return snapshot;
  }),
  authorizeEntryExpansion = (
    context: CmsServiceOperationContext,
    input: AuthorizeEntryExpansionInput,
  ): Effect.Effect<void, CmsError> =>
    Effect.gen(function* authorizeEntryExpansionEffect() {
      if (input.expansion === undefined || input.expansion.length === 0) {
        return;
      }
      if (input.entryId === undefined) {
        yield* context.authorize("entry.expand", {
          contentTypeId: input.contentTypeId,
          definitionSpaceId: input.snapshot.definitionSpaceId,
          kind: "contentType",
        });
        return;
      }
      yield* context.authorize(
        "entry.expand",
        entryResource(input.snapshot, input.contentTypeId, input.entryId),
      );
    }),
  authorizeGetEntry = (
    context: CmsServiceOperationContext,
    input: ReadInput,
  ): Effect.Effect<CompiledSnapshot, CmsError> =>
    Effect.gen(function* authorizeGetEntryEffect() {
      const snapshot = yield* context.currentDefinitionSnapshot;
      yield* context.authorize(
        "entry.read",
        entryResource(snapshot, input.contentTypeId, input.entryId),
      );
      yield* authorizeEntryExpansion(context, {
        contentTypeId: input.contentTypeId,
        entryId: input.entryId,
        expansion: input.expansion,
        snapshot,
      });
      return snapshot;
    }),
  authorizeQueryEntries = (
    context: CmsServiceOperationContext,
    query: Query,
  ): Effect.Effect<CompiledSnapshot, CmsError> =>
    Effect.gen(function* authorizeQueryEntriesEffect() {
      const snapshot = yield* context.currentDefinitionSnapshot;
      yield* context.authorize("entry.query", {
        contentTypeId: query.contentTypeId,
        definitionSpaceId: snapshot.definitionSpaceId,
        kind: "contentType",
      });
      yield* authorizeEntryExpansion(context, {
        contentTypeId: query.contentTypeId,
        entryId: undefined,
        expansion: query.expansion,
        snapshot,
      });
      return snapshot;
    }),
  commitCreatedEntryWithHistory = (
    context: CmsServiceOperationContext,
    input: CommitCreatedEntryWithHistoryInput,
  ): Effect.Effect<MutationResult, CmsError> =>
    Effect.gen(function* commitCreatedEntryWithHistoryEffect() {
      const revision: Revision = {
          definitionSnapshotId: input.snapshot.snapshotId,
          recordedAt: DateTime.formatIso(yield* DateTime.now),
          revisionNumber: 1,
          values: cloneJson(input.values),
        },
        writeToken = yield* context.identifiers.generate("write-token");
      input.records.set(input.entryId, {
        entry: input.entry,
        revisions: [revision],
        writeToken,
      });
      yield* context.persistence.commitGeneration(input.generation.generation, input.records);
      return { entry: input.entry, revisionNumber: 1, writeToken };
    }),
  expandQueryPage = (input: ExpandQueryPageInput): Effect.Effect<QueryPage, CmsError> =>
    Effect.gen(function* expandQueryPageEffect() {
      if (input.expansion === undefined || input.expansion.length === 0) {
        return input.page;
      }
      const items = yield* attempt(() =>
        input.page.items.map((entry) =>
          expandRepresentation({
            entry,
            expansion: input.expansion,
            generation: input.generation,
            snapshot: input.snapshot,
          }),
        ),
      );
      if (input.page.nextCursor === undefined) {
        return { items };
      }
      return { items, nextCursor: input.page.nextCursor };
    }),
  persistCreatedEntry = (
    context: CmsServiceOperationContext,
    input: PersistCreatedEntryInput,
  ): Effect.Effect<MutationResult, CmsError> =>
    Effect.gen(function* persistCreatedEntryEffect() {
      const entryId = yield* context.identifiers.generate("entry"),
        entry: Representation = {
          contentTypeId: input.input.contentTypeId,
          id: entryId,
          values: input.prepared.values,
        },
        records = new Map(input.prepared.generation.records);
      if (input.prepared.contentType.definition.history !== true) {
        return yield* commitEntryWithoutHistory(
          context,
          entry,
          entryId,
          input.prepared.generation.generation,
          records,
        );
      }
      return yield* commitCreatedEntryWithHistory(context, {
        entry,
        entryId,
        generation: input.prepared.generation,
        records,
        snapshot: input.snapshot,
        values: input.prepared.values,
      });
    }),
  prepareCreateEntry = (
    context: CmsServiceOperationContext,
    snapshot: CompiledSnapshot,
    input: CreateInput,
  ): Effect.Effect<PreparedCreateEntry, CmsError> =>
    Effect.gen(function* prepareCreateEntryEffect() {
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
      return { contentType, generation, values };
    }),
  prepareDeleteEntry = (
    context: CmsServiceOperationContext,
    snapshot: CompiledSnapshot,
    input: DeleteEntryInput,
  ): Effect.Effect<PreparedDeleteEntry, CmsError> =>
    Effect.gen(function* prepareDeleteEntryEffect() {
      const generation = yield* context.persistence.readGeneration,
        current = yield* assertLiveEntry(
          generation.records.get(input.entryId),
          input.contentTypeId,
          input.entryId,
        ),
        contentType = snapshot.contentTypes.get(input.contentTypeId);
      if (contentType === undefined) {
        return yield* NotFound.make({ message: `Entry ${input.entryId} was not found` });
      }
      yield* assertWriteToken(contentType, current, input.writeToken);
      yield* assertReferenceDeletionAllowed(snapshot, generation, input.entryId);
      return { contentType, current, generation, records: new Map(generation.records) };
    }),
  prepareUpdateEntry = (
    context: CmsServiceOperationContext,
    snapshot: CompiledSnapshot,
    input: UpdateInput,
  ): Effect.Effect<PreparedUpdateEntry, CmsError> =>
    Effect.gen(function* prepareUpdateEntryEffect() {
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
      return { contentType, current, entry, generation, records, snapshotId: snapshot.snapshotId };
    }),
  readLiveEntryRecord = (
    context: CmsServiceOperationContext,
    input: ReadInput,
  ): Effect.Effect<EntryRecord, CmsError> =>
    Effect.gen(function* readLiveEntryRecordEffect() {
      const generation = yield* context.persistence.readGeneration;
      return yield* assertLiveEntry(
        generation.records.get(input.entryId),
        input.contentTypeId,
        input.entryId,
      );
    }),
  recordDeletedEntry = (
    context: CmsServiceOperationContext,
    prepared: PreparedDeleteEntry,
    input: DeleteEntryInput,
  ): Effect.Effect<DeletionRecord, CmsError> =>
    Effect.gen(function* recordDeletedEntryEffect() {
      const deletedAt = DateTime.formatIso(yield* DateTime.now),
        now = yield* Clock.currentTimeMillis,
        writeToken = yield* context.identifiers.generate("write-token"),
        deletionRecord: DeletionRecord = {
          contentTypeId: input.contentTypeId,
          deletedAt,
          entryId: input.entryId,
          latestRevisionNumber: prepared.current.revisions.at(-1)?.revisionNumber ?? 0,
          writeToken,
        };
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
    context: CmsServiceOperationContext,
    input: RemoveDeletedEntryRecordInput,
  ): Effect.Effect<void, CmsError> =>
    Effect.gen(function* removeDeletedEntryRecordEffect() {
      input.records.delete(input.entryId);
      yield* context.persistence.commitGeneration(input.generation, input.records);
    }),
  runCreateEntry = (
    context: CmsServiceOperationContext,
    input: CreateInput,
  ): Effect.Effect<MutationResult, CmsError> =>
    Effect.gen(function* runCreateEntryEffect() {
      const snapshot = yield* context.currentDefinitionSnapshot,
        prepared = yield* prepareCreateEntry(context, snapshot, input);
      return yield* persistCreatedEntry(context, { input, prepared, snapshot });
    }),
  runDeleteEntry = (
    context: CmsServiceOperationContext,
    input: DeleteEntryInput,
  ): Effect.Effect<DeleteResult, CmsError> =>
    Effect.gen(function* runDeleteEntryEffect() {
      const snapshot = yield* authorizeDeleteEntry(context, input),
        prepared = yield* prepareDeleteEntry(context, snapshot, input);
      if (prepared.contentType.definition.history !== true) {
        return yield* removeDeletedEntryRecord(context, {
          entryId: input.entryId,
          generation: prepared.generation.generation,
          records: prepared.records,
        });
      }
      return yield* recordDeletedEntry(context, prepared, input);
    }),
  runGetEntry = (
    context: CmsServiceOperationContext,
    input: ReadInput,
  ): Effect.Effect<Representation, CmsError> =>
    Effect.gen(function* runGetEntryEffect() {
      const snapshot = yield* authorizeGetEntry(context, input),
        generation = yield* context.persistence.readGeneration,
        record = yield* readLiveEntryRecord(context, input);
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
  runQueryEntries = (
    context: CmsServiceOperationContext,
    query: Query,
  ): Effect.Effect<QueryPage, CmsError> =>
    Effect.gen(function* runQueryEntriesEffect() {
      const snapshot = yield* authorizeQueryEntries(context, query),
        generation = yield* context.persistence.readGeneration,
        page = yield* attempt(() =>
          evaluateQuery({
            entries: liveRecords(generation).map((record) => record.entry),
            options: { generation: generation.generation },
            query,
            snapshot,
          }),
        );
      return yield* expandQueryPage({
        expansion: query.expansion,
        generation,
        page,
        snapshot,
      });
    }),
  runUpdateEntry = (
    context: CmsServiceOperationContext,
    input: UpdateInput,
  ): Effect.Effect<MutationResult, CmsError> =>
    Effect.gen(function* runUpdateEntryEffect() {
      const snapshot = yield* context.currentDefinitionSnapshot,
        prepared = yield* prepareUpdateEntry(context, snapshot, input);
      if (prepared.contentType.definition.history !== true) {
        return yield* commitEntryWithoutHistory(
          context,
          prepared.entry,
          input.entryId,
          prepared.generation.generation,
          prepared.records,
        );
      }
      return yield* commitEntryWithHistory(context, {
        contentType: prepared.contentType,
        currentRevisions: prepared.current.revisions,
        entry: prepared.entry,
        entryId: input.entryId,
        generation: prepared.generation.generation,
        records: prepared.records,
        snapshotId: prepared.snapshotId,
        values: prepared.entry.values,
      });
    });

export default {
  runCreateEntry,
  runDeleteEntry,
  runGetEntry,
  runQueryEntries,
  runUpdateEntry,
};

export type { PreparedDeleteEntry, PreparedUpdateEntry };
