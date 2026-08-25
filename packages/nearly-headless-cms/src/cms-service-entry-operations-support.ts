import type { CreateInput, ReadInput, Representation, UpdateInput } from "./entry.ts";
import type { DeleteEntryInput, DeleteResult, MutationResult } from "./cms-types.ts";
import type { Query, QueryPage } from "./entry-query.ts";
import type { CmsError } from "./cms-error.ts";
import type { CmsServiceOperationContext } from "./cms-service-operation-context.ts";
import type { CompiledSnapshot } from "./content-definition.ts";
import { Effect } from "effect";
import cmsSupport from "./cms-support.ts";
import entryOperationSupport from "./cms-service-entry-operation-support.ts";
import entryOperationsPrepareSupport from "./cms-service-entry-operations-prepare-support.ts";
import { evaluate as evaluateQuery } from "./entry-query-evaluation.ts";

interface AuthorizeEntryExpansionInput {
  readonly contentTypeId: string;
  readonly entryId: string | undefined;
  readonly expansion: readonly string[] | undefined;
  readonly snapshot: CompiledSnapshot;
}

const { attempt, entryResource, expandRepresentation, liveRecords, project } = cmsSupport,
  { commitEntryWithHistory, commitEntryWithoutHistory } = entryOperationSupport,
  {
    expandQueryPage,
    persistCreatedEntry,
    prepareCreateEntry,
    prepareDeleteEntry,
    prepareUpdateEntry,
    readLiveEntryRecord,
    recordDeletedEntry,
    removeDeletedEntryRecord,
  } = entryOperationsPrepareSupport,
  authorizeDeleteEntry = (
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
  runCreateEntry = (
    context: CmsServiceOperationContext,
    input: CreateInput,
  ): Effect.Effect<MutationResult, CmsError> =>
    Effect.gen(function* runCreateEntryEffect() {
      const createEntryState = {
          snapshot: yield* context.currentDefinitionSnapshot,
        },
        prepared = yield* prepareCreateEntry(context, createEntryState.snapshot, input);
      return yield* persistCreatedEntry(context, {
        input,
        prepared,
        snapshot: createEntryState.snapshot,
      });
    }),
  runDeleteEntry = (
    context: CmsServiceOperationContext,
    input: DeleteEntryInput,
  ): Effect.Effect<DeleteResult, CmsError> =>
    Effect.gen(function* runDeleteEntryEffect() {
      const deleteEntryState = {
          snapshot: yield* authorizeDeleteEntry(context, input),
        },
        prepared = yield* prepareDeleteEntry(context, deleteEntryState.snapshot, input);
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
      const generation = yield* context.persistence.readGeneration,
        record = yield* readLiveEntryRecord(context, input),
        snapshot = yield* authorizeGetEntry(context, input);
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
      const contextSnapshotForQuery = yield* authorizeQueryEntries(context, query),
        generation = yield* context.persistence.readGeneration,
        page = yield* attempt(() =>
          evaluateQuery({
            entries: liveRecords(generation).map((record) => record.entry),
            options: { generation: generation.generation },
            query,
            snapshot: contextSnapshotForQuery,
          }),
        );
      return yield* expandQueryPage({
        expansion: query.expansion,
        generation,
        page,
        snapshot: contextSnapshotForQuery,
      });
    }),
  runUpdateEntry = (
    context: CmsServiceOperationContext,
    input: UpdateInput,
  ): Effect.Effect<MutationResult, CmsError> =>
    Effect.gen(function* runUpdateEntryEffect() {
      const contextSnapshotForUpdate = yield* context.currentDefinitionSnapshot,
        prepared = yield* prepareUpdateEntry(context, contextSnapshotForUpdate, input);
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

export type {
  PreparedDeleteEntry,
  PreparedUpdateEntry,
} from "./cms-service-entry-operations-prepare-support.ts";
