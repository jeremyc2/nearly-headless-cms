import type { RouteHandlerContext, RouteHandlerResult } from "./http-transport-types.ts";
import {
  httpStatusCreated,
  httpStatusMethodNotAllowed,
  httpStatusNoContent,
  httpStatusOk,
} from "./http-status-codes.ts";
import dispatchRouteHandlers from "./http-transport-route-dispatch.ts";
import entryRouteSupport from "./http-transport-entry-route-support.ts";
import transportOperation from "./http-transport-operation.ts";
import transportResponse from "./http-transport-response.ts";

const { bodylessResponse, invalidRequestResponse } = transportResponse,
  { matchPath, requiredPathParameter } = transportOperation,
  {
    entryJsonResponse,
    handleEntryRevisionDetailRoute,
    handleEntryRevisionsListRoute,
    handleEntryStateRoute,
    readEntryQueryInput,
    readOptionalStringArrayField,
    requireJsonObjectValues,
    requireSafeInteger,
    requireWriteToken,
  } = entryRouteSupport,
  dispatchEntryResourceMethod = (
    context: Readonly<RouteHandlerContext>,
    contentTypeId: string,
    entryId: string,
  ): RouteHandlerResult | Promise<RouteHandlerResult> => {
    if (context.request.method === "GET") {
      return handleEntryResourceGetRoute(context, contentTypeId, entryId);
    }
    if (context.request.method === "PUT") {
      return handleEntryResourcePutRoute(context, contentTypeId, entryId);
    }
    if (context.request.method === "DELETE") {
      return handleEntryResourceDeleteRoute(context, contentTypeId, entryId);
    }
    return entryJsonResponse(context, httpStatusMethodNotAllowed, {
      code: "MethodNotAllowed",
      message: "Method not allowed",
      requestId: context.requestId,
    });
  },
  // oxlint-disable-next-line effecttsgo/async-function -- route handlers await JSON body parsing before Effect execution.
  handleEntryCreateRoute = async (
    context: Readonly<RouteHandlerContext>,
  ): Promise<RouteHandlerResult> => {
    const createMatch = matchPath(
      `${context.managementBase}/content-types/{contentTypeId}/entries`,
      context.requestUrl.pathname,
    );
    if (createMatch === undefined || context.request.method !== "POST") {
      return undefined;
    }
    try {
      const body = await context.parseJson(context.request, context.maximumJsonBodyByteLength);
      return await context.withOutcome(
        () =>
          context.cms.createEntry({
            contentTypeId: requiredPathParameter(createMatch, "contentTypeId"),
            values: requireJsonObjectValues(body["values"], "Entry create requires values"),
          }),
        context.requestId,
        (result) => entryJsonResponse(context, httpStatusCreated, result),
      );
    } catch (error) {
      return invalidRequestResponse(error, "Invalid Entry create request", context.requestId);
    }
  },
  // oxlint-disable-next-line effecttsgo/async-function -- route handlers await JSON body parsing before Effect execution.
  handleEntryPurgeRoute = async (
    context: Readonly<RouteHandlerContext>,
  ): Promise<RouteHandlerResult> => {
    const purgeMatch = matchPath(
      `${context.managementBase}/content-types/{contentTypeId}/entries/{entryId}/purges`,
      context.requestUrl.pathname,
    );
    if (purgeMatch === undefined || context.request.method !== "POST") {
      return undefined;
    }
    try {
      const body = await context.parseJson(context.request, context.maximumJsonBodyByteLength);
      return await context.withOutcome(
        () =>
          context.cms.permanentlyPurgeEntry({
            contentTypeId: requiredPathParameter(purgeMatch, "contentTypeId"),
            entryId: requiredPathParameter(purgeMatch, "entryId"),
            writeToken: requireWriteToken(
              body["writeToken"],
              "Permanent Purge requires writeToken",
            ),
          }),
        context.requestId,
        () => bodylessResponse(httpStatusNoContent, context.requestId, context.fingerprint),
      );
    } catch (error) {
      return invalidRequestResponse(error, "Invalid Permanent Purge request", context.requestId);
    }
  },
  // oxlint-disable-next-line effecttsgo/async-function -- route handlers await JSON body parsing before Effect execution.
  handleEntryQueryRoute = async (
    context: Readonly<RouteHandlerContext>,
  ): Promise<RouteHandlerResult> => {
    const queryMatch = matchPath(
      `${context.managementBase}/content-types/{contentTypeId}/entries/query`,
      context.requestUrl.pathname,
    );
    if (queryMatch === undefined || context.request.method !== "POST") {
      return undefined;
    }
    try {
      const body = await context.parseJson(context.request, context.maximumJsonBodyByteLength),
        contentTypeId = requiredPathParameter(queryMatch, "contentTypeId");
      return await context.withOutcome(
        () => context.cms.queryEntries(readEntryQueryInput(body, contentTypeId)),
        context.requestId,
        (result) => entryJsonResponse(context, httpStatusOk, result),
      );
    } catch (error) {
      return invalidRequestResponse(error, "Invalid Entry Query request", context.requestId);
    }
  },
  handleEntryResourceDeleteRoute = (
    context: Readonly<RouteHandlerContext>,
    contentTypeId: string,
    entryId: string,
  ): RouteHandlerResult | Promise<RouteHandlerResult> =>
    context.withOutcome(
      () =>
        context.cms.deleteEntry({
          contentTypeId,
          entryId,
          writeToken: context.request.headers.get("cms-write-token") ?? undefined,
        }),
      context.requestId,
      (deletionRecord) => {
        if (deletionRecord === undefined) {
          return bodylessResponse(httpStatusNoContent, context.requestId, context.fingerprint);
        }
        return entryJsonResponse(context, httpStatusOk, deletionRecord);
      },
    ),
  handleEntryResourceGetRoute = (
    context: Readonly<RouteHandlerContext>,
    contentTypeId: string,
    entryId: string,
  ): RouteHandlerResult | Promise<RouteHandlerResult> =>
    context.withOutcome(
      () => context.cms.getEntry({ contentTypeId, entryId }),
      context.requestId,
      (entry) => entryJsonResponse(context, httpStatusOk, entry),
    ),
  // oxlint-disable-next-line effecttsgo/async-function -- route handlers await JSON body parsing before Effect execution.
  handleEntryResourcePutRoute = async (
    context: Readonly<RouteHandlerContext>,
    contentTypeId: string,
    entryId: string,
  ): Promise<RouteHandlerResult> => {
    try {
      const body = await context.parseJson(context.request, context.maximumJsonBodyByteLength);
      return await context.withOutcome(
        () =>
          context.cms.updateEntry({
            contentTypeId,
            entryId,
            values: requireJsonObjectValues(body["values"], "Entry replacement requires values"),
            writeToken: context.request.headers.get("cms-write-token") ?? undefined,
          }),
        context.requestId,
        (result) => entryJsonResponse(context, httpStatusOk, result),
      );
    } catch (error) {
      return invalidRequestResponse(error, "Invalid Entry replacement request", context.requestId);
    }
  },
  handleEntryResourceRoute = (
    context: Readonly<RouteHandlerContext>,
  ): RouteHandlerResult | Promise<RouteHandlerResult> => {
    const entryMatch = matchPath(
      `${context.managementBase}/content-types/{contentTypeId}/entries/{entryId}`,
      context.requestUrl.pathname,
    );
    if (entryMatch === undefined) {
      return undefined;
    }
    return dispatchEntryResourceMethod(
      context,
      requiredPathParameter(entryMatch, "contentTypeId"),
      requiredPathParameter(entryMatch, "entryId"),
    );
  },
  // oxlint-disable-next-line effecttsgo/async-function -- route handlers await JSON body parsing before Effect execution.
  handleEntryRestorationRoute = async (
    context: Readonly<RouteHandlerContext>,
  ): Promise<RouteHandlerResult> => {
    const restorationMatch = matchPath(
      `${context.managementBase}/content-types/{contentTypeId}/entries/{entryId}/restorations`,
      context.requestUrl.pathname,
    );
    if (restorationMatch === undefined || context.request.method !== "POST") {
      return undefined;
    }
    try {
      const body = await context.parseJson(context.request, context.maximumJsonBodyByteLength);
      return await context.withOutcome(
        () =>
          context.cms.restoreEntryRevision({
            contentTypeId: requiredPathParameter(restorationMatch, "contentTypeId"),
            entryId: requiredPathParameter(restorationMatch, "entryId"),
            revisionNumber: requireSafeInteger(
              body["revisionNumber"],
              "Entry restoration requires revisionNumber and writeToken",
            ),
            writeToken: requireWriteToken(
              body["writeToken"],
              "Entry restoration requires revisionNumber and writeToken",
            ),
          }),
        context.requestId,
        (state) => entryJsonResponse(context, httpStatusCreated, state),
      );
    } catch (error) {
      return invalidRequestResponse(error, "Invalid Entry restoration request", context.requestId);
    }
  },
  handleEntryRoutes = (context: Readonly<RouteHandlerContext>): Promise<RouteHandlerResult> =>
    dispatchRouteHandlers(
      [
        handleEntryCreateRoute,
        handleEntryQueryRoute,
        handleStructuredEntryReadRoute,
        handleEntryResourceRoute,
        handleEntryStateRoute,
        handleEntryRevisionsListRoute,
        handleEntryRevisionDetailRoute,
        handleEntryRestorationRoute,
        handleEntryPurgeRoute,
      ],
      context,
    ),
  // oxlint-disable-next-line effecttsgo/async-function -- route handlers await JSON body parsing before Effect execution.
  handleStructuredEntryReadRoute = async (
    context: Readonly<RouteHandlerContext>,
  ): Promise<RouteHandlerResult> => {
    const readMatch = matchPath(
      `${context.managementBase}/content-types/{contentTypeId}/entries/{entryId}/read`,
      context.requestUrl.pathname,
    );
    if (readMatch === undefined || context.request.method !== "POST") {
      return undefined;
    }
    try {
      const body = await context.parseJson(context.request, context.maximumJsonBodyByteLength),
        expansion = readOptionalStringArrayField(
          body["expansion"],
          "Expansion must be an array of Relationship paths",
        ),
        projection = readOptionalStringArrayField(
          body["projection"],
          "Projection must be an array of Field Paths",
        );
      return await context.withOutcome(
        () =>
          context.cms.getEntry({
            contentTypeId: requiredPathParameter(readMatch, "contentTypeId"),
            entryId: requiredPathParameter(readMatch, "entryId"),
            expansion,
            projection,
          }),
        context.requestId,
        (entry) => entryJsonResponse(context, httpStatusOk, entry),
      );
    } catch (error) {
      return invalidRequestResponse(
        error,
        "Invalid structured Entry read request",
        context.requestId,
      );
    }
  };

export default handleEntryRoutes;
