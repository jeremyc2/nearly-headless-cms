import { InvalidInput, NotFound } from "../cms-error.ts";
import { type JsonObject, isJsonObject } from "../internal/json.ts";
import type { RouteHandlerContext, RouteHandlerResult } from "./http-transport-types.ts";
import type { AppendDefinitionRevisionInput } from "../cms-types.ts";
import { Effect } from "effect";
import { httpStatusOk } from "./http-status-codes.ts";
import transportOperation from "./http-transport-operation.ts";
import transportResponse from "./http-transport-response.ts";

type Definition = AppendDefinitionRevisionInput["definition"];

const { jsonResponse } = transportResponse,
  { matchPath, requiredPathParameter } = transportOperation,
  catalogJsonResponse = (
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
  handleDefinitionDetailRoute = (
    context: Readonly<RouteHandlerContext>,
  ): RouteHandlerResult | Promise<RouteHandlerResult> => {
    const definitionMatch = matchPath(
      `${context.managementBase}/definitions/{definitionId}`,
      context.requestUrl.pathname,
    );
    if (definitionMatch === undefined || context.request.method !== "GET") {
      return undefined;
    }
    return context.withOutcome(
      () =>
        context.cms.readDefinitionCatalog().pipe(
          Effect.flatMap((state) => {
            const definition = state.active.input.definitions.find(
                (candidate) =>
                  candidate.id === requiredPathParameter(definitionMatch, "definitionId"),
              ),
              definitionId = requiredPathParameter(definitionMatch, "definitionId");
            if (definition === undefined) {
              return Effect.fail(
                NotFound.make({ message: `Definition ${definitionId} was not found` }),
              );
            }
            return Effect.succeed({
              catalogVersion: state.version,
              definition,
              retired: state.retiredDefinitionIds.has(definitionId),
            });
          }),
        ),
      context.requestId,
      (value) => catalogJsonResponse(context, httpStatusOk, value),
    );
  },
  handleDefinitionRevisionsListRoute = (
    context: Readonly<RouteHandlerContext>,
    definitionId: string,
  ): RouteHandlerResult | Promise<RouteHandlerResult> =>
    context.withOutcome(
      () => context.cms.readDefinitionCatalog(),
      context.requestId,
      (state) =>
        catalogJsonResponse(context, httpStatusOk, {
          catalogVersion: state.version,
          items: state.revisions.filter((revision) => revision.definitionId === definitionId),
        }),
    ),
  handleDefinitionSnapshotDetailRoute = (
    context: Readonly<RouteHandlerContext>,
  ): RouteHandlerResult | Promise<RouteHandlerResult> => {
    const definitionSnapshotMatch = matchPath(
      `${context.managementBase}/definition-snapshots/{snapshotId}`,
      context.requestUrl.pathname,
    );
    if (definitionSnapshotMatch === undefined || context.request.method !== "GET") {
      return undefined;
    }
    return context.withOutcome(
      () =>
        context.cms.readDefinitionCatalog().pipe(
          Effect.flatMap((state) => {
            const snapshotId = requiredPathParameter(definitionSnapshotMatch, "snapshotId"),
              snapshotRecord = state.snapshots.find(
                (candidate) => candidate.compiled.snapshotId === snapshotId,
              );
            if (snapshotRecord === undefined) {
              return Effect.fail(
                NotFound.make({ message: `Definition Snapshot ${snapshotId} was not found` }),
              );
            }
            return Effect.succeed({
              ...snapshotRecord.input,
              activatedAt: snapshotRecord.activatedAt,
              fingerprint: snapshotRecord.compiled.fingerprint,
            });
          }),
        ),
      context.requestId,
      (value) => catalogJsonResponse(context, httpStatusOk, value),
    );
  },
  hasStringField = (value: JsonObject, key: string): boolean =>
    typeof Reflect.get(value, key) === "string",
  isDefinition = (value: unknown): value is Definition => {
    if (!isJsonObject(value)) {
      return false;
    }
    if (!hasStringField(value, "id")) {
      return false;
    }
    if (!hasStringField(value, "name")) {
      return false;
    }
    const kind: unknown = Reflect.get(value, "kind");
    if (kind !== "contentType" && kind !== "fieldGroup") {
      return false;
    }
    return Array.isArray(Reflect.get(value, "fields"));
  },
  isMatchingDefinition = (value: unknown, definitionId: string): value is Definition =>
    isDefinition(value) && value.id === definitionId,
  readDefinitionRevisionAppendInput = (
    body: JsonObject,
    definitionId: string,
  ): Pick<AppendDefinitionRevisionInput, "definition" | "expectedCatalogVersion"> => ({
    definition: requireMatchingDefinition(
      body["definition"],
      definitionId,
      "Definition revision append requires a matching definition and expectedCatalogVersion",
    ),
    expectedCatalogVersion: requireSafeInteger(
      body["expectedCatalogVersion"],
      "Definition revision append requires a matching definition and expectedCatalogVersion",
    ),
  }),
  requireMatchingDefinition = (
    value: unknown,
    definitionId: string,
    message: string,
  ): Definition => {
    if (!isMatchingDefinition(value, definitionId)) {
      throw InvalidInput.make({ message });
    }
    return value;
  },
  requireSafeInteger = (value: unknown, message: string): number => {
    if (typeof value !== "number" || !Number.isSafeInteger(value)) {
      throw InvalidInput.make({ message });
    }
    return value;
  };

export default {
  catalogJsonResponse,
  handleDefinitionDetailRoute,
  handleDefinitionRevisionsListRoute,
  handleDefinitionSnapshotDetailRoute,
  readDefinitionRevisionAppendInput,
  requireSafeInteger,
};
