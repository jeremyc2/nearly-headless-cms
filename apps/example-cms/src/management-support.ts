import {
  type Cms,
  CmsError,
  type ContentDefinition,
  type Entry,
  type EntryQuery,
} from "nearly-headless-cms";
import { type ReadonlyTransportRequest, toWebRequest } from "nearly-headless-cms/http";
import { Effect } from "effect";

const appendQueryPage = <
    Accumulated extends Entry.Representation[],
    Page extends { items: readonly Entry.Representation[]; nextCursor?: string },
  >(
    accumulated: Accumulated,
    page: Readonly<Page>,
  ): { accumulated: Accumulated; nextCursor: Page["nextCursor"] } => {
    for (const item of page.items) {
      accumulated.push(item);
    }
    return { accumulated, nextCursor: page.nextCursor };
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
  queryAllEntries = <CmsService extends Cms.ServiceShape>(
    cms: Readonly<CmsService>,
    query: Readonly<Omit<EntryQuery.Query, "cursor">>,
  ): Effect.Effect<readonly Entry.Representation[], CmsError.CmsError> =>
    Effect.gen(function* collectAllMatchingEntries() {
      const accumulated: Entry.Representation[] = [];
      for (let { nextCursor } = appendQueryPage(accumulated, yield* cms.queryEntries(query)); ; ) {
        if (nextCursor === undefined) {
          return accumulated;
        }
        ({ nextCursor } = appendQueryPage(
          accumulated,
          yield* cms.queryEntries({ ...query, cursor: nextCursor }),
        ));
      }
    }),
  requireDeletionRecord = (
    result: Cms.EntryBatchMutationResult | undefined,
  ): Effect.Effect<Exclude<Cms.DeleteResult, undefined>, CmsError.InfrastructureFailure> => {
    if (result !== undefined && "writeToken" in result && !("entry" in result)) {
      return Effect.succeed(result);
    }
    return CmsError.InfrastructureFailure.make({
      cause: result,
      message: "History-enabled deletion did not return its deletion record",
      retryable: false,
    });
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
  requiredWriteToken = (
    request: ReadonlyTransportRequest,
  ): Effect.Effect<string, CmsError.InvalidInput> => {
    const writeToken = toWebRequest(request).headers.get("cms-write-token");
    if (writeToken === null || writeToken.length === 0) {
      return CmsError.InvalidInput.make({ message: "CMS-Write-Token is required" });
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
