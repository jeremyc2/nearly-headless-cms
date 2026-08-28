import type { RouteHandlerContext, RouteHandlerResult } from "./http-transport-types.ts";
import {
  httpStatusBadRequest,
  httpStatusCreated,
  httpStatusNoContent,
  httpStatusOk,
  httpStatusSeeOther,
  httpStatusUnsupportedMediaType,
} from "./http-status-codes.ts";
import { RequestFailureError } from "./http-transport-request-failure.ts";
import dispatchRouteHandlers from "./http-transport-route-dispatch.ts";
import transportOperation from "./http-transport-operation.ts";
import transportRequestParsing from "./http-transport-request-parsing.ts";
import transportResponse from "./http-transport-response.ts";

const {
    assetContentResponse,
    bodylessResponse,
    invalidRequestResponse,
    jsonResponse,
    redirectResponse,
  } = transportResponse,
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
      () => context.cms.prepareAssetDownload(requiredPathParameter(assetContentMatch, "assetId")),
      context.requestId,
      (target) => {
        if (target.kind === "redirect-url") {
          return redirectResponse(target.url, httpStatusSeeOther, context.requestId);
        }
        return assetContentResponse(target, context.request, context.requestId);
      },
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
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-068] route handlers await JSON body parsing before Effect execution.
  handleJsonAssetUpload = async (
    context: Readonly<RouteHandlerContext>,
  ): Promise<RouteHandlerResult> => {
    const metadata = readAssetMetadata(
      await context.parseJson(context.request, context.maximumJsonBodyByteLength),
    );
    return context.withOutcome(
      () => context.cms.prepareAssetUpload(metadata),
      context.requestId,
      (target) => {
        if (target.kind === "presigned-url") {
          return jsonResponse({
            fingerprint: context.fingerprint,
            requestId: context.requestId,
            status: httpStatusCreated,
            value: target,
          });
        }
        return invalidRequestResponse(
          new RequestFailureError(
            "UnsupportedMediaType",
            "This Asset Adapter requires multipart/form-data",
            httpStatusUnsupportedMediaType,
          ),
          "Asset upload requires multipart/form-data",
          context.requestId,
        );
      },
    );
  },
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-068] route handlers stage multipart bytes before Effect execution.
  handleMultipartAssetUpload = async (
    context: Readonly<RouteHandlerContext>,
  ): Promise<RouteHandlerResult> => {
    const stagedUpload = await stageMultipartAsset(context.request, context.signal, {
      body: context.maximumMultipartBodyByteLength,
      file: context.maximumMultipartFileByteLength,
      metadata: context.maximumMultipartMetadataByteLength,
    });
    try {
      return await context.withOutcome(
        () => context.cms.ingestAsset({ ...stagedUpload.metadata, content: stagedUpload.content }),
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
  },
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-068] route handlers await JSON body parsing before Effect execution.
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
        (context.request.headers.get("content-type") ?? "")
          .toLowerCase()
          .startsWith("application/json")
      ) {
        return await handleJsonAssetUpload(context);
      }
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
      return await handleMultipartAssetUpload(context);
    } catch (error) {
      return invalidRequestResponse(error, "Invalid multipart Asset upload", context.requestId);
    }
  },
  optionalFiniteNumber = (value: unknown, fieldName: string): number | undefined => {
    if (value === undefined) {
      return undefined;
    }
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new RequestFailureError(
        "InvalidRequest",
        `Asset upload ${fieldName} must be a finite number`,
        httpStatusBadRequest,
      );
    }
    return value;
  },
  optionalString = (value: unknown, fieldName: string): string | undefined => {
    if (value === undefined) {
      return undefined;
    }
    if (typeof value !== "string") {
      throw new RequestFailureError(
        "InvalidRequest",
        `Asset upload ${fieldName} must be a string`,
        httpStatusBadRequest,
      );
    }
    return value;
  },
  requiredString = (value: unknown, fieldName: string): string => {
    const parsed = optionalString(value, fieldName);
    if (parsed === undefined || parsed.trim().length === 0) {
      throw new RequestFailureError(
        "InvalidRequest",
        `Asset upload requires ${fieldName}`,
        httpStatusBadRequest,
      );
    }
    return parsed;
  },
  readAssetMetadata = (body: Readonly<Record<string, unknown>>) => {
    const metadata: {
        defaultAlternativeText?: string;
        filename: string;
        height?: number;
        mediaType: string;
        width?: number;
      } = {
        filename: requiredString(body["filename"], "filename"),
        mediaType: requiredString(body["mediaType"], "mediaType"),
      },
      defaultAlternativeText = optionalString(
        body["defaultAlternativeText"],
        "defaultAlternativeText",
      ),
      height = optionalFiniteNumber(body["height"], "height"),
      width = optionalFiniteNumber(body["width"], "width");
    if (defaultAlternativeText !== undefined) {
      metadata.defaultAlternativeText = defaultAlternativeText;
    }
    if (height !== undefined) {
      metadata.height = height;
    }
    if (width !== undefined) {
      metadata.width = width;
    }
    return metadata;
  };

export default handleAssetRoutes;
