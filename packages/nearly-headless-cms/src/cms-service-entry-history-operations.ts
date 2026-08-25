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
    (context: Readonly<CmsServiceOperationContext>) =>
    (input: Pick<ReadInput, "contentTypeId" | "entryId">): Effect.Effect<CurrentState, CmsError> =>
      runGetCurrentEntryState(context, input),
  inspectEntryRevisionMethod =
    (context: Readonly<CmsServiceOperationContext>) =>
    (input: Readonly<ReadRevisionInput>): Effect.Effect<Revision, CmsError> =>
      runInspectEntryRevision(context, input),
  listEntryRevisionsMethod =
    (context: Readonly<CmsServiceOperationContext>) =>
    (input: Readonly<ListRevisionsInput>): Effect.Effect<RevisionPage, CmsError> =>
      runListEntryRevisions(context, input),
  permanentlyPurgeEntryMethod =
    (context: Readonly<CmsServiceOperationContext>) =>
    (input: Readonly<PurgeEntryInput>): Effect.Effect<void, CmsError> =>
      runPermanentlyPurgeEntry(context, input),
  restoreEntryRevisionMethod =
    (context: Readonly<CmsServiceOperationContext>) =>
    (input: Readonly<RestoreInput>): Effect.Effect<CurrentState, CmsError> =>
      runRestoreEntryRevision(context, input);

export default {
  getCurrentEntryState: getCurrentEntryStateMethod,
  inspectEntryRevision: inspectEntryRevisionMethod,
  listEntryRevisions: listEntryRevisionsMethod,
  permanentlyPurgeEntry: permanentlyPurgeEntryMethod,
  restoreEntryRevision: restoreEntryRevisionMethod,
};
