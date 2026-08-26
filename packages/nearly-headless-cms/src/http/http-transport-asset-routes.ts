import type { RouteHandlerContext, RouteHandlerResult } from "./http-transport-types.ts";
import {
  httpStatusCreated,
  httpStatusNoContent,
  httpStatusOk,
  httpStatusUnsupportedMediaType,
} from "./http-status-codes.ts";
import { RequestFailureError } from "./http-transport-request-failure.ts";
import dispatchRouteHandlers from "./http-transport-route-dispatch.ts";
import transportOperation from "./http-transport-operation.ts";
import transportRequestParsing from "./http-transport-request-parsing.ts";
import transportResponse from "./http-transport-response.ts";

const { assetContentResponse, bodylessResponse, invalidRequestResponse, jsonResponse } =
    transportResponse,
  { matchPath, requiredPathParameter } = transportOperation,
  { stageMultipartAsset } = transportRequestParsing,
  handleAssetContentRoute = (
    context: Readonly<RouteHandlerContext>,
  ): RouteHandlerResult | Promise<RouteHandlerResult> => {
    const assetContentMatch = matchPath(
      `${context.managementBase}/assets/{assetId}/content`,
      context.requestUrl.pathname,
    );
    if (
      assetContentMatch === undefined ||
      (context.request.method !== "GET" && context.request.method !== "HEAD")
    ) {
      return undefined;
    }
    return context.withOutcome(
      () => context.cms.readAsset(requiredPathParameter(assetContentMatch, "assetId")),
      context.requestId,
      (asset) => assetContentResponse(asset, context.request, context.requestId),
    );
  },
  handleAssetResourceRoute = (
    context: Readonly<RouteHandlerContext>,
  ): RouteHandlerResult | Promise<RouteHandlerResult> => {
    const assetMatch = matchPath(
      `${context.managementBase}/assets/{assetId}`,
      context.requestUrl.pathname,
    );
    if (assetMatch === undefined) {
      return undefined;
    }
    if (context.request.method === "GET") {
      return context.withOutcome(
        () => context.cms.getAsset(requiredPathParameter(assetMatch, "assetId")),
        context.requestId,
        (asset) =>
          jsonResponse({
            fingerprint: context.fingerprint,
            requestId: context.requestId,
            status: httpStatusOk,
            value: asset,
          }),
      );
    }
    if (context.request.method === "DELETE") {
      return context.withOutcome(
        () => context.cms.deleteAsset(requiredPathParameter(assetMatch, "assetId")),
        context.requestId,
        () => bodylessResponse(httpStatusNoContent, context.requestId, context.fingerprint),
      );
    }
    return undefined;
  },
  handleAssetRoutes = (context: Readonly<RouteHandlerContext>): Promise<RouteHandlerResult> =>
    dispatchRouteHandlers(
      [handleAssetContentRoute, handleAssetResourceRoute, handleAssetUploadRoute],
      context,
    ),
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-059] route handlers await JSON body parsing before Effect execution.
  handleAssetUploadRoute = async (
    context: Readonly<RouteHandlerContext>,
  ): Promise<RouteHandlerResult> => {
    if (
      context.requestUrl.pathname !== `${context.managementBase}/assets` ||
      context.request.method !== "POST"
    ) {
      return undefined;
    }
    try {
      if (
        !(context.request.headers.get("content-type") ?? "")
          .toLowerCase()
          .startsWith("multipart/form-data")
      ) {
        throw new RequestFailureError(
          "UnsupportedMediaType",
          "Asset upload requires multipart/form-data",
          httpStatusUnsupportedMediaType,
        );
      }
      const stagedUpload = await stageMultipartAsset(context.request, context.signal, {
        body: context.maximumMultipartBodyByteLength,
        file: context.maximumMultipartFileByteLength,
        metadata: context.maximumMultipartMetadataByteLength,
      });
      try {
        return await context.withOutcome(
          () =>
            context.cms.ingestAsset({ ...stagedUpload.metadata, content: stagedUpload.content }),
          context.requestId,
          (asset) =>
            jsonResponse({
              fingerprint: context.fingerprint,
              requestId: context.requestId,
              status: httpStatusCreated,
              value: asset,
            }),
        );
      } finally {
        await stagedUpload.cleanup();
      }
    } catch (error) {
      return invalidRequestResponse(error, "Invalid multipart Asset upload", context.requestId);
    }
  };

export default handleAssetRoutes;
