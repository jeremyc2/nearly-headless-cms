import {
  type CmsError,
  InvalidInput,
} from "./cms-error.ts";
import type { CompiledContentType, CompiledSnapshot } from "./content-definition.ts";
import type { CreateInput, ReadInput, Representation, UpdateInput } from "./entry.ts";
import { DateTime, Effect } from "effect";
import type { EntryGeneration, EntryRecord } from "./persistence.ts";
import type { CmsServiceOperationContext } from "./cms-service-operation-context.ts";
import type { MutationResult } from "./cms-types.ts";
import type { QueryPage } from "./entry-query.ts";
import type { Revision } from "./entry-history.ts";
import { cloneJson } from "./internal/json.ts";
import cmsSupport from "./cms-support.ts";
import entryOperationSupport from "./cms-service-entry-operation-support.ts";
import entryOperationsPrepareDeleteSupport from "./cms-service-entry-operations-prepare-delete-support.ts";

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

interface PreparedUpdateEntry {
  readonly contentType: CompiledContentType;
  readonly current: EntryRecord;
  readonly entry: Representation;
  readonly generation: EntryGeneration;
  readonly records: Map<string, EntryRecord>;
  readonly snapshotId: string;
}

interface ValidatePreparedUpdateEntryInput {
  readonly contentType: CompiledContentType | undefined;
  readonly context: CmsServiceOperationContext;
  readonly current: EntryRecord;
  readonly entry: Representation;
  readonly generation: EntryGeneration;
  readonly records: Map<string, EntryRecord>;
  readonly snapshot: CompiledSnapshot;
  readonly updateInput: UpdateInput;
}

const {
    attempt,
    collectReferences,
    ensureReferences,
    ensureUniqueValues,
    entryResource,
    expandRepresentation,
  } = cmsSupport,
  {
    assertLiveEntry,
    assertWriteToken,
    commitEntryWithoutHistory,
  } = entryOperationSupport,
  { prepareDeleteEntry, recordDeletedEntry, removeDeletedEntryRecord } =
    entryOperationsPrepareDeleteSupport,
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
  finalizePreparedUpdateEntry = (
    input: ValidatePreparedUpdateEntryInput,
  ): Effect.Effect<PreparedUpdateEntry, CmsError> =>
    Effect.gen(function* finalizePreparedUpdateEntryEffect() {
      if (input.contentType === undefined) {
        return yield* InvalidInput.make({
          message: `Unknown Content Type ${input.updateInput.contentTypeId}`,
        });
      }
      const {contentType} = input;
      yield* assertWriteToken(contentType, input.current, input.updateInput.writeToken);
      yield* attempt(() => {
        ensureUniqueValues({
          contentType,
          ignoredEntryId: input.updateInput.entryId,
          records: input.generation.records.values(),
          values: input.entry.values,
        });
      });
      yield* ensureReferences(
        yield* attempt(() => collectReferences(contentType, input.entry.values)),
        input.generation,
        input.context.assets,
      );
      return {
        contentType,
        current: input.current,
        entry: input.entry,
        generation: input.generation,
        records: input.records,
        snapshotId: input.snapshot.snapshotId,
      };
    }),
  persistCreatedEntry = (
    context: CmsServiceOperationContext,
    input: PersistCreatedEntryInput,
  ): Effect.Effect<MutationResult, CmsError> =>
    Effect.gen(function* persistCreatedEntryEffect() {
      const entry: Representation = {
          contentTypeId: input.input.contentTypeId,
          id: yield* context.identifiers.generate("entry"),
          values: input.prepared.values,
        },
        records = new Map(input.prepared.generation.records);
      if (input.prepared.contentType.definition.history !== true) {
        return yield* commitEntryWithoutHistory({
          context,
          entry,
          generation: input.prepared.generation.generation,
          records,
        });
      }
      return yield* commitCreatedEntryWithHistory(context, {
        entry,
        entryId: entry.id,
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
      const contentType = snapshot.contentTypes.get(input.contentTypeId),
        generation = yield* context.persistence.readGeneration,
        values = yield* attempt(() =>
          snapshot.validateEntry(input.contentTypeId, input.values, { applyDefaults: true }),
        );
      if (contentType === undefined) {
        return yield* InvalidInput.make({
          message: `Unknown Content Type ${input.contentTypeId}`,
        });
      }
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
      const contentType = snapshot.contentTypes.get(input.contentTypeId),
        current = yield* assertLiveEntry(
          (yield* context.persistence.readGeneration).records.get(input.entryId),
          input.contentTypeId,
          input.entryId,
        ),
        entry: Representation = {
          contentTypeId: input.contentTypeId,
          id: input.entryId,
          values: yield* attempt(() =>
            snapshot.validateEntry(input.contentTypeId, input.values, { applyDefaults: false }),
          ),
        },
        generation = yield* context.persistence.readGeneration,
        records = new Map(generation.records);
      return yield* finalizePreparedUpdateEntry({
        contentType,
        context,
        current,
        entry,
        generation,
        records,
        snapshot,
        updateInput: input,
      });
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
    });

export default {
  expandQueryPage,
  persistCreatedEntry,
  prepareCreateEntry,
  prepareDeleteEntry,
  prepareUpdateEntry,
  readLiveEntryRecord,
  recordDeletedEntry,
  removeDeletedEntryRecord,
};
export type { PreparedDeleteEntry } from "./cms-service-entry-operations-prepare-delete-support.ts";
export type { PreparedUpdateEntry };
