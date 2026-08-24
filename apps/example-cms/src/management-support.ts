import {
  type Cms,
  CmsError,
  type ContentDefinition,
  type Entry,
  type EntryQuery,
} from "nearly-headless-cms";
import { Effect } from "effect";

const appendQueryPage = (
  accumulated: Entry.Representation[],
  page: { items: readonly Entry.Representation[]; nextCursor?: string },
): string | undefined => {
  for (const item of page.items) {
    accumulated.push(item);
  }
  return page.nextCursor;
},

 conditionalProperty = <Value>(
    condition: boolean,
    property: string,
    value: Value,
  ): Record<string, Value> => {
    if (condition) {
      return { [property]: value };
    }
    return {};
  },
  isJsonValueArray = (
    value: ContentDefinition.JsonValue,
  ): value is readonly ContentDefinition.JsonValue[] => Array.isArray(value),
  isRecord = (value: object): value is Record<string, unknown> =>
    Object.keys(value).every((key) => typeof key === "string"),
  queryAllEntries = (
    cms: Cms.ServiceShape,
    query: Omit<EntryQuery.Query, "cursor">,
  ): Effect.Effect<readonly Entry.Representation[], CmsError.CmsError> =>
    Effect.gen(function* collectAllMatchingEntries() {
      const accumulated: Entry.Representation[] = [];
      let nextCursor;
      for (;;) {
        let queryWithCursor = query as EntryQuery.Query;
        if (nextCursor !== undefined) {
          queryWithCursor = { ...query, cursor: nextCursor };
        }
        nextCursor = appendQueryPage(accumulated, yield* cms.queryEntries(queryWithCursor));
        if (nextCursor === undefined) {
          return accumulated;
        }
      }
    }),
  requireDeletionRecord = (
    result: Cms.EntryBatchMutationResult | undefined,
  ): Effect.Effect<Exclude<Cms.DeleteResult, undefined>, CmsError.InfrastructureFailure> => {
    if (result !== undefined && "writeToken" in result && !("entry" in result)) {
      return Effect.succeed(result);
    }
    return Effect.fail(
      CmsError.InfrastructureFailure.make({
        cause: result,
        message: "History-enabled deletion did not return its deletion record",
        retryable: false,
      }),
    );
  },
  requiredParameter = (
    parameters: Readonly<Record<string, string | undefined>>,
    name: string,
  ): string => {
    const value = parameters[name];
    if (value === undefined) {
      throw new Error(`Missing required parameter: ${name}`);
    }
    return value;
  },
  requiredWriteToken = (request: Request): Effect.Effect<string, CmsError.InvalidInput> => {
    const writeToken = request.headers.get("cms-write-token");
    if (writeToken === null || writeToken.length === 0) {
      return Effect.fail(CmsError.InvalidInput.make({ message: "CMS-Write-Token is required" }));
    }
    return Effect.succeed(writeToken);
  };

export default {
  conditionalProperty,
  isJsonValueArray,
  isRecord,
  queryAllEntries,
  requireDeletionRecord,
  requiredParameter,
  requiredWriteToken,
};
