import { type JsonObject, isJsonObject } from "../internal/json.ts";
import type { Predicate, Query, Sort } from "../entry-query.ts";
import type { RouteHandlerContext, RouteHandlerResult } from "./http-transport-types.ts";
import { InvalidInput } from "../cms-error.ts";
import { httpStatusOk } from "./http-status-codes.ts";
import transportOperation from "./http-transport-operation.ts";
import transportResponse from "./http-transport-response.ts";

const { jsonResponse } = transportResponse,
  { matchPath, requiredPathParameter } = transportOperation,
  appendOptionalArrayFields = (query: Query, body: JsonObject): Query => {
    const { expansion, projection, sort, where } = body,
      withExpansion = appendOptionalExpansion(query, expansion),
      withProjection = appendOptionalProjection(withExpansion, projection),
      withSort = appendOptionalSort(withProjection, sort);
    return appendOptionalWhere(withSort, where);
  },
  appendOptionalExpansion = (query: Query, expansion: unknown): Query => {
    const optionalExpansion = readOptionalStringArray(expansion);
    if (optionalExpansion === undefined) {
      return query;
    }
    return { ...query, expansion: optionalExpansion };
  },
  appendOptionalProjection = (query: Query, projection: unknown): Query => {
    const optionalProjection = readOptionalStringArray(projection);
    if (optionalProjection === undefined) {
      return query;
    }
    return { ...query, projection: optionalProjection };
  },
  appendOptionalQueryFields = (query: Query, body: JsonObject): Query => {
    const { cursor } = body;
    if (typeof cursor === "string") {
      return appendOptionalArrayFields({ ...query, cursor }, body);
    }
    return appendOptionalArrayFields(query, body);
  },
  appendOptionalSort = (query: Query, sort: unknown): Query => {
    const optionalSort = readOptionalSortList(sort);
    if (optionalSort === undefined) {
      return query;
    }
    return { ...query, sort: optionalSort };
  },
  appendOptionalWhere = (query: Query, where: unknown): Query => {
    const optionalWhere = readOptionalPredicate(where);
    if (optionalWhere === undefined) {
      return query;
    }
    return { ...query, where: optionalWhere };
  },
  defaultEntryQueryPageSize = 20,
  entryJsonResponse = (
    context: Readonly<RouteHandlerContext>,
    status: number,
    value: unknown,
  ): Response =>
    jsonResponse({
      fingerprint: context.fingerprint,
      requestId: context.requestId,
      status,
      value,
    }),
  handleEntryRevisionDetailRoute = (
    context: Readonly<RouteHandlerContext>,
  ): RouteHandlerResult | Promise<RouteHandlerResult> => {
    const revisionMatch = matchPath(
      `${context.managementBase}/content-types/{contentTypeId}/entries/{entryId}/revisions/{revisionNumber}`,
      context.requestUrl.pathname,
    );
    if (revisionMatch === undefined || context.request.method !== "GET") {
      return undefined;
    }
    return context.withOutcome(
      () => context.cms.inspectEntryRevision(readRevisionDetailParameters(revisionMatch)),
      context.requestId,
      (revision) => entryJsonResponse(context, httpStatusOk, revision),
    );
  },
  handleEntryRevisionsListRoute = (
    context: Readonly<RouteHandlerContext>,
  ): RouteHandlerResult | Promise<RouteHandlerResult> => {
    const revisionsMatch = matchPath(
      `${context.managementBase}/content-types/{contentTypeId}/entries/{entryId}/revisions`,
      context.requestUrl.pathname,
    );
    if (revisionsMatch === undefined || context.request.method !== "GET") {
      return undefined;
    }
    return context.withOutcome(
      () => context.cms.listEntryRevisions(readRevisionListParameters(context, revisionsMatch)),
      context.requestId,
      (page) => entryJsonResponse(context, httpStatusOk, page),
    );
  },
  handleEntryStateRoute = (
    context: Readonly<RouteHandlerContext>,
  ): RouteHandlerResult | Promise<RouteHandlerResult> => {
    const stateMatch = matchPath(
      `${context.managementBase}/content-types/{contentTypeId}/entries/{entryId}/state`,
      context.requestUrl.pathname,
    );
    if (stateMatch === undefined || context.request.method !== "GET") {
      return undefined;
    }
    return context.withOutcome(
      () =>
        context.cms.getCurrentEntryState({
          contentTypeId: requiredPathParameter(stateMatch, "contentTypeId"),
          entryId: requiredPathParameter(stateMatch, "entryId"),
        }),
      context.requestId,
      (state) => entryJsonResponse(context, httpStatusOk, state),
    );
  },
  isFieldPredicateShape = (value: object): boolean =>
    Reflect.has(value, "path") &&
    Reflect.has(value, "operator") &&
    typeof Reflect.get(value, "path") === "string" &&
    typeof Reflect.get(value, "operator") === "string",
  isLogicalAllPredicate = (value: object): boolean => {
    const all: unknown = Reflect.get(value, "all");
    return Array.isArray(all) && all.every((candidate) => isPredicate(candidate));
  },
  isLogicalAnyPredicate = (value: object): boolean => {
    const any: unknown = Reflect.get(value, "any");
    return Array.isArray(any) && any.every((candidate) => isPredicate(candidate));
  },
  isLogicalNotPredicate = (value: object): boolean => {
    if (!Reflect.has(value, "not")) {
      return false;
    }
    const not: unknown = Reflect.get(value, "not");
    return isPredicate(not);
  },
  isPredicate = (value: unknown): value is Predicate => {
    if (typeof value !== "object" || value === null) {
      return false;
    }
    if (isFieldPredicateShape(value)) {
      return true;
    }
    if (isLogicalAllPredicate(value)) {
      return true;
    }
    if (isLogicalAnyPredicate(value)) {
      return true;
    }
    return isLogicalNotPredicate(value);
  },
  isSort = (value: unknown): value is Sort => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return false;
    }
    const direction: unknown = Reflect.get(value, "direction"),
      path: unknown = Reflect.get(value, "path");
    return typeof path === "string" && (direction === "ascending" || direction === "descending");
  },
  readEntryQueryInput = (body: JsonObject, contentTypeId: string): Query =>
    appendOptionalQueryFields(
      { contentTypeId, pageSize: readQueryPageSize(body["pageSize"]) },
      body,
    ),
  readOptionalPredicate = (value: unknown): Predicate | undefined => {
    if (value === undefined) {
      return undefined;
    }
    if (!isPredicate(value)) {
      throw InvalidInput.make({ message: "where must be a valid query predicate" });
    }
    return value;
  },
  readOptionalSortList = (value: unknown): readonly Sort[] | undefined => {
    if (value === undefined) {
      return undefined;
    }
    if (!Array.isArray(value) || !value.every((candidate) => isSort(candidate))) {
      throw InvalidInput.make({ message: "sort must be an array of sort specifications" });
    }
    return value;
  },
  readOptionalStringArray = (value: unknown): readonly string[] | undefined => {
    if (value === undefined) {
      return undefined;
    }
    if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
      throw InvalidInput.make({ message: "Expected an array of strings" });
    }
    return value;
  },
  readOptionalStringArrayField = (
    value: unknown,
    message: string,
  ): readonly string[] | undefined => {
    if (value === undefined) {
      return undefined;
    }
    return requireStringArray(value, message);
  },
  readQueryPageSize = (pageSize: unknown): number => {
    if (typeof pageSize === "number" && Number.isSafeInteger(pageSize)) {
      return pageSize;
    }
    return defaultEntryQueryPageSize;
  },
  readRevisionDetailParameters = (revisionMatch: Readonly<Record<string, string>>) => {
    const contentTypeId = requiredPathParameter(revisionMatch, "contentTypeId"),
      entryId = requiredPathParameter(revisionMatch, "entryId"),
      revisionNumber = Number(requiredPathParameter(revisionMatch, "revisionNumber"));
    return { contentTypeId, entryId, revisionNumber };
  },
  readRevisionListParameters = (
    context: Readonly<RouteHandlerContext>,
    revisionsMatch: Readonly<Record<string, string>>,
  ) => {
    const contentTypeId = requiredPathParameter(revisionsMatch, "contentTypeId"),
      entryId = requiredPathParameter(revisionsMatch, "entryId"),
      pageSize = Number(context.requestUrl.searchParams.get("pageSize") ?? "20");
    return {
      contentTypeId,
      cursor: context.requestUrl.searchParams.get("cursor") ?? undefined,
      entryId,
      pageSize,
    };
  },
  requireJsonObjectValues = (value: unknown, message: string): JsonObject => {
    if (!isJsonObject(value)) {
      throw InvalidInput.make({ message });
    }
    return value;
  },
  requireSafeInteger = (value: unknown, message: string): number => {
    if (typeof value !== "number" || !Number.isSafeInteger(value)) {
      throw InvalidInput.make({ message });
    }
    return value;
  },
  requireStringArray = (value: unknown, message: string): readonly string[] => {
    if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
      throw InvalidInput.make({ message });
    }
    return value;
  },
  requireWriteToken = (value: unknown, message: string): string => {
    if (typeof value !== "string") {
      throw InvalidInput.make({ message });
    }
    return value;
  };

export default {
  entryJsonResponse,
  handleEntryRevisionDetailRoute,
  handleEntryRevisionsListRoute,
  handleEntryStateRoute,
  readEntryQueryInput,
  readOptionalStringArrayField,
  requireJsonObjectValues,
  requireSafeInteger,
  requireWriteToken,
};
