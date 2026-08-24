import {
  type CmsError,
  Conflict,
  NotFound,
} from "./cms-error.ts";
import { Effect } from "effect";
import type { CompiledContentType, CompiledSnapshot } from "./content-definition.ts";
import type { RestoreInput, Revision, RevisionPage } from "./entry-history.ts";
import type { CmsServiceOperationContext } from "./cms-service-operation-context.ts";
import type { EntryRecord } from "./persistence.ts";
import type { PurgeEntryInput } from "./cms-types.ts";
import cmsSupport from "./cms-support.ts";

const { attempt, decodeHistoryCursor, entryResource, historyCursor } = cmsSupport,
  assertDeletedEntry = (
    record: EntryRecord | undefined,
    input: PurgeEntryInput,
  ): Effect.Effect<EntryRecord, CmsError> => {
    if (
      record === undefined ||
      record.entry.contentTypeId !== input.contentTypeId ||
      record.deletionRecord === undefined
    ) {
      return Effect.fail(
        NotFound.make({ message: `Deleted Entry ${input.entryId} was not found` }),
      );
    }
    if (record.writeToken !== input.writeToken) {
      return Effect.fail(Conflict.make({ message: "Write Token is stale" }));
    }
    return Effect.succeed(record);
  },
  assertHistoryEnabledEntry = (
    record: EntryRecord | undefined,
    contentTypeId: string,
    entryId: string,
  ): Effect.Effect<{ readonly record: EntryRecord; readonly writeToken: string }, CmsError> => {
    if (
      record === undefined ||
      record.deletionRecord !== undefined ||
      record.entry.contentTypeId !== contentTypeId ||
      record.writeToken === undefined ||
      record.revisions.length === 0
    ) {
      return Effect.fail(
        NotFound.make({ message: `History-enabled Entry ${entryId} was not found` }),
      );
    }
    return Effect.succeed({ record, writeToken: record.writeToken });
  },
  assertRestorableEntry = (
    contentType: CompiledContentType | undefined,
    current: EntryRecord | undefined,
    input: RestoreInput,
  ): Effect.Effect<{ readonly contentType: CompiledContentType; readonly current: EntryRecord }, CmsError> => {
    if (contentType?.definition.history !== true || current === undefined || current.writeToken !== input.writeToken) {
      if (current === undefined) {
        return Effect.fail(
          NotFound.make({ message: `Entry History ${input.entryId} was not found` }),
        );
      }
      return Effect.fail(Conflict.make({ message: "Write Token is stale" }));
    }
    return Effect.succeed({ contentType, current });
  },
  authorizeHistoryEntry = (
    context: CmsServiceOperationContext,
    input: {
      readonly action: "entry.history.purge" | "entry.history.read" | "entry.history.restore";
      readonly contentTypeId: string;
      readonly entryId: string;
    },
  ): Effect.Effect<CompiledSnapshot, CmsError> =>
    Effect.gen(function* authorizeHistoryEntryEffect() {
      const snapshot = yield* context.currentDefinitionSnapshot;
      yield* context.authorize(
        input.action,
        entryResource(snapshot, input.contentTypeId, input.entryId),
      );
      return snapshot;
    }),
  buildRevisionPage = (
    input: {
      readonly cursor: string | undefined;
      readonly entryId: string;
      readonly pageSize: number;
      readonly revisions: readonly Revision[];
    },
  ): Effect.Effect<RevisionPage, CmsError> =>
    Effect.gen(function* buildRevisionPageEffect() {
      const newestFirst = [...input.revisions].toReversed(),
        offset = yield* attempt(() => decodeHistoryCursor(input.cursor, input.entryId)),
        pageItems = newestFirst
          .slice(offset, offset + input.pageSize)
          .map(({ values: _values, ...metadata }) => metadata);
      if (offset + pageItems.length < newestFirst.length) {
        return { items: pageItems, nextCursor: historyCursor(offset + pageItems.length, input.entryId) };
      }
      return { items: pageItems };
    }),
  findSourceRevision = (
    current: EntryRecord,
    revisionNumber: number,
  ): Effect.Effect<Revision, CmsError> => {
    const sourceRevision = current.revisions.find(
      (revision) => revision.revisionNumber === revisionNumber,
    );
    if (sourceRevision === undefined) {
      return Effect.fail(
        NotFound.make({ message: `Entry Revision ${revisionNumber} was not found` }),
      );
    }
    return Effect.succeed(sourceRevision);
  };

export default {
  assertDeletedEntry,
  assertHistoryEnabledEntry,
  assertRestorableEntry,
  authorizeHistoryEntry,
  buildRevisionPage,
  findSourceRevision,
};
