import type { RouteHandlerContext, RouteHandlerResult } from "./http-transport-types.ts";
import { httpStatusCreated, httpStatusOk } from "./http-status-codes.ts";
import catalogRouteSupport from "./http-transport-definition-catalog-route-support.ts";
import dispatchRouteHandlers from "./http-transport-route-dispatch.ts";
import transportOperation from "./http-transport-operation.ts";
import transportResponse from "./http-transport-response.ts";

const { invalidRequestResponse } = transportResponse,
  { matchPath, requiredPathParameter } = transportOperation,
  {
    catalogJsonResponse,
    handleDefinitionDetailRoute,
    handleDefinitionRevisionsListRoute,
    handleDefinitionSnapshotDetailRoute,
    readDefinitionRevisionAppendInput,
    requireSafeInteger,
  } = catalogRouteSupport,
  handleDefinitionCatalogRoutes = (
    context: Readonly<RouteHandlerContext>,
  ): Promise<RouteHandlerResult> => dispatchRouteHandlers(managementCatalogRouteHandlers, context),
  // oxlint-disable-next-line effecttsgo/async-function -- route handlers await JSON body parsing before Effect execution.
  handleDefinitionRetirementRoute = async (
    context: Readonly<RouteHandlerContext>,
  ): Promise<RouteHandlerResult> => {
    const retirementMatch = matchPath(
      `${context.managementBase}/definitions/{definitionId}/retirements`,
      context.requestUrl.pathname,
    );
    if (retirementMatch === undefined || context.request.method !== "POST") {
      return undefined;
    }
    try {
      const body = await context.parseJson(context.request, context.maximumJsonBodyByteLength);
      return await context.withOutcome(
        () =>
          context.cms.retireDefinition({
            definitionId: requiredPathParameter(retirementMatch, "definitionId"),
            expectedCatalogVersion: requireSafeInteger(
              body["expectedCatalogVersion"],
              "Definition retirement requires expectedCatalogVersion",
            ),
            source: "management-http",
          }),
        context.requestId,
        (state) =>
          catalogJsonResponse(context, httpStatusCreated, { catalogVersion: state.version }),
      );
    } catch (error) {
      return invalidRequestResponse(
        error,
        "Invalid Definition retirement request",
        context.requestId,
      );
    }
  },
  // oxlint-disable-next-line effecttsgo/async-function -- route handlers await JSON body parsing before Effect execution.
  handleDefinitionRevisionAppendRoute = async (
    context: Readonly<RouteHandlerContext>,
    definitionId: string,
  ): Promise<RouteHandlerResult> => {
    try {
      const body = await context.parseJson(context.request, context.maximumJsonBodyByteLength),
        revisionAppendInput = readDefinitionRevisionAppendInput(body, definitionId);
      return await context.withOutcome(
        () =>
          context.cms.appendDefinitionRevision({
            ...revisionAppendInput,
            source: "management-http",
          }),
        context.requestId,
        (state) =>
          catalogJsonResponse(context, httpStatusCreated, { catalogVersion: state.version }),
      );
    } catch (error) {
      return invalidRequestResponse(
        error,
        "Invalid Definition revision append request",
        context.requestId,
      );
    }
  },
  handleDefinitionRevisionsRoute = (
    context: Readonly<RouteHandlerContext>,
  ): RouteHandlerResult | Promise<RouteHandlerResult> => {
    const definitionRevisionsMatch = matchPath(
      `${context.managementBase}/definitions/{definitionId}/revisions`,
      context.requestUrl.pathname,
    );
    if (definitionRevisionsMatch === undefined) {
      return undefined;
    }
    if (context.request.method === "GET") {
      return handleDefinitionRevisionsListRoute(
        context,
        requiredPathParameter(definitionRevisionsMatch, "definitionId"),
      );
    }
    if (context.request.method === "POST") {
      return handleDefinitionRevisionAppendRoute(
        context,
        requiredPathParameter(definitionRevisionsMatch, "definitionId"),
      );
    }
    return undefined;
  },
  handleDefinitionSnapshotRoute = (context: Readonly<RouteHandlerContext>): RouteHandlerResult => {
    if (
      context.requestUrl.pathname !== `${context.managementBase}/definition-snapshot` ||
      context.request.method !== "GET"
    ) {
      return undefined;
    }
    return catalogJsonResponse(context, httpStatusOk, {
      ...context.snapshot.input,
      fingerprint: context.fingerprint,
    });
  },
  handleDefinitionSnapshotsListRoute = (
    context: Readonly<RouteHandlerContext>,
  ): RouteHandlerResult | Promise<RouteHandlerResult> => {
    if (
      context.requestUrl.pathname !== `${context.managementBase}/definition-snapshots` ||
      context.request.method !== "GET"
    ) {
      return undefined;
    }
    return context.withOutcome(
      () => context.cms.readDefinitionCatalog(),
      context.requestId,
      (state) =>
        catalogJsonResponse(context, httpStatusOk, {
          catalogVersion: state.version,
          items: state.snapshots.map((snapshotRecord) => ({
            ...snapshotRecord.input,
            activatedAt: snapshotRecord.activatedAt,
            fingerprint: snapshotRecord.compiled.fingerprint,
          })),
        }),
    );
  },
  handleDefinitionsListRoute = (
    context: Readonly<RouteHandlerContext>,
  ): RouteHandlerResult | Promise<RouteHandlerResult> => {
    if (
      context.requestUrl.pathname !== `${context.managementBase}/definitions` ||
      context.request.method !== "GET"
    ) {
      return undefined;
    }
    return context.withOutcome(
      () => context.cms.readDefinitionCatalog(),
      context.requestId,
      (state) =>
        catalogJsonResponse(context, httpStatusOk, {
          catalogVersion: state.version,
          items: state.active.input.definitions,
        }),
    );
  },
  managementCatalogRouteHandlers = [
    handleDefinitionSnapshotRoute,
    handleDefinitionsListRoute,
    handleDefinitionDetailRoute,
    handleDefinitionRevisionsRoute,
    handleDefinitionRetirementRoute,
    handleDefinitionSnapshotsListRoute,
    handleDefinitionSnapshotDetailRoute,
  ];

export default handleDefinitionCatalogRoutes;
