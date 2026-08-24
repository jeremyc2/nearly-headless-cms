import type {
  CurrentState,
  ListRevisionsInput,
  RestoreInput,
  Revision,
  RevisionPage,
} from "./entry-history.ts";
import type { PurgeEntryInput, ReadRevisionInput } from "./cms-types.ts";
import type { CmsError } from "./cms-error.ts";
import type { CmsServiceOperationContext } from "./cms-service-operation-context.ts";
import type { Effect } from "effect";
import type { ReadInput } from "./entry.ts";
import entryHistoryOperationsSupport from "./cms-service-entry-history-operations-support.ts";

const {
  runGetCurrentEntryState,
  runInspectEntryRevision,
  runListEntryRevisions,
  runPermanentlyPurgeEntry,
  runRestoreEntryRevision,
} = entryHistoryOperationsSupport,
  getCurrentEntryStateMethod =
    (context: CmsServiceOperationContext) =>
    (input: Pick<ReadInput, "contentTypeId" | "entryId">): Effect.Effect<CurrentState, CmsError> =>
      runGetCurrentEntryState(context, input),
  inspectEntryRevisionMethod =
    (context: CmsServiceOperationContext) =>
    (input: ReadRevisionInput): Effect.Effect<Revision, CmsError> =>
      runInspectEntryRevision(context, input),
  listEntryRevisionsMethod =
    (context: CmsServiceOperationContext) =>
    (input: ListRevisionsInput): Effect.Effect<RevisionPage, CmsError> =>
      runListEntryRevisions(context, input),
  permanentlyPurgeEntryMethod =
    (context: CmsServiceOperationContext) =>
    (input: PurgeEntryInput): Effect.Effect<void, CmsError> =>
      runPermanentlyPurgeEntry(context, input),
  restoreEntryRevisionMethod =
    (context: CmsServiceOperationContext) =>
    (input: RestoreInput): Effect.Effect<CurrentState, CmsError> =>
      runRestoreEntryRevision(context, input);

export default {
  getCurrentEntryState: getCurrentEntryStateMethod,
  inspectEntryRevision: inspectEntryRevisionMethod,
  listEntryRevisions: listEntryRevisionsMethod,
  permanentlyPurgeEntry: permanentlyPurgeEntryMethod,
  restoreEntryRevision: restoreEntryRevisionMethod,
};
