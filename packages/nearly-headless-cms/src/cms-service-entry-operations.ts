import type { CreateInput, ReadInput, Representation, UpdateInput } from "./entry.ts";
import type { DeleteEntryInput, DeleteResult, MutationResult } from "./cms-types.ts";
import type { Query, QueryPage } from "./entry-query.ts";
import type { CmsError } from "./cms-error.ts";
import type { CmsServiceOperationContext } from "./cms-service-operation-context.ts";
import type { Effect } from "effect";
import entryOperationsSupport from "./cms-service-entry-operations-support.ts";

const { runCreateEntry, runDeleteEntry, runGetEntry, runQueryEntries, runUpdateEntry } =
    entryOperationsSupport,
  createEntryMethod =
    (context: Readonly<CmsServiceOperationContext>) =>
    (input: Readonly<CreateInput>): Effect.Effect<MutationResult, CmsError> =>
      runCreateEntry(context, input),
  deleteEntryMethod =
    (context: Readonly<CmsServiceOperationContext>) =>
    (input: Readonly<DeleteEntryInput>): Effect.Effect<DeleteResult, CmsError> =>
      runDeleteEntry(context, input),
  getEntryMethod =
    (context: Readonly<CmsServiceOperationContext>) =>
    (input: Readonly<ReadInput>): Effect.Effect<Representation, CmsError> =>
      runGetEntry(context, input),
  queryEntriesMethod =
    (context: Readonly<CmsServiceOperationContext>) =>
    (query: Readonly<Query>): Effect.Effect<QueryPage, CmsError> =>
      runQueryEntries(context, query),
  updateEntryMethod =
    (context: Readonly<CmsServiceOperationContext>) =>
    (input: Readonly<UpdateInput>): Effect.Effect<MutationResult, CmsError> =>
      runUpdateEntry(context, input);

export default {
  createEntry: createEntryMethod,
  deleteEntry: deleteEntryMethod,
  getEntry: getEntryMethod,
  queryEntries: queryEntriesMethod,
  updateEntry: updateEntryMethod,
};
