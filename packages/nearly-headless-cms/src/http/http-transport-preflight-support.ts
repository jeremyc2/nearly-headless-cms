import * as HttpApiContract from "./http-api.ts";
import { type Options, type RouteHandlerContext } from "./http-transport-types.ts";
import { discovery, headlessPrefix, managementPrefix } from "./http-contract.ts";
import { RequestFailureError } from "./http-transport-request-failure.ts";
import transportResponse from "./http-transport-response.ts";

interface TransportLimits {
  readonly maximumHeaderByteLength: number;
  readonly maximumJsonBodyByteLength: number;
  readonly maximumUrlLength: number;
}

const { bodylessResponse, jsonResponse, requestFailureResponse } = transportResponse,
  acceptsJson = (accept: string | null): boolean => {
    if (accept === null) {
      return true;
    }
    return accept.split(",").some((mediaRange) => {
      const mediaType = mediaRange.split(";", 1)[0]?.trim().toLowerCase();
      return mediaType === "*/*" || mediaType === "application/json";
    });
  },
  computeHeaderByteLength = (request: Request): number =>
    [...request.headers].reduce(
      (total, [name, value]) => total + name.length + value.length + 4,
      0,
    ),
  handleCorsPreflight = (
    request: Request,
    requestId: string,
    options: Options,
  ): Response | undefined => {
    if (request.method !== "OPTIONS" || options.cors === undefined) {
      return undefined;
    }
    const origin = request.headers.get("origin");
    if (origin === null || !options.cors.origins.includes(origin)) {
      return bodylessResponse(403, requestId);
    }
    return new Response(null, {
      headers: {
        "access-control-allow-headers": options.cors.headers.join(", "),
        "access-control-allow-methods": options.cors.methods.join(", "),
        "access-control-allow-origin": origin,
        vary: "Origin",
        "x-request-id": requestId,
      },
      status: 204,
    });
  },
  handleDiscoveryRoute = (
    context: RouteHandlerContext,
    operations: NonNullable<Options["deliveryOperations"]>,
  ): Response | undefined => {
    if (
      context.requestUrl.pathname !== `${headlessPrefix}/schema` ||
      context.request.method !== "GET"
    ) {
      return undefined;
    }
    const headers = transportResponse.responseHeaders(
      context.requestId,
      context.fingerprint,
      "no-cache",
    );
    headers.set("content-type", "application/json; charset=utf-8");
    headers.set("etag", `"${context.fingerprint}"`);
    if (context.request.headers.get("if-none-match") === `"${context.fingerprint}"`) {
      return new Response(null, { headers, status: 304 });
    }
    return Response.json(discovery({ operations, snapshot: context.snapshot }), {
      headers,
      status: 200,
    });
  },
  handleOpenApiRoutes = (
    context: RouteHandlerContext,
    operations: NonNullable<Options["deliveryOperations"]>,
    managementOperations: NonNullable<Options["managementOperations"]>,
  ): Response | undefined => {
    if (
      context.requestUrl.pathname === `${managementPrefix}/openapi.json` &&
      context.request.method === "GET"
    ) {
      return jsonResponse({
        fingerprint: context.fingerprint,
        requestId: context.requestId,
        status: 200,
        value: HttpApiContract.managementDocument(managementOperations),
      });
    }
    if (context.requestUrl.pathname === `${headlessPrefix}/openapi.json` && context.request.method === "GET") {
      return jsonResponse({
        cacheControl: "no-cache",
        fingerprint: context.fingerprint,
        requestId: context.requestId,
        status: 200,
        value: HttpApiContract.headlessDocument(operations),
      });
    }
    return undefined;
  },
  isAssetRequest = (request: Request): boolean => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return false;
    }
    return /\/assets\/[^/]+$/u.test(new URL(request.url).pathname);
  },
  validateTransportLimits = (
    request: Request,
    requestId: string,
    limits: TransportLimits,
  ): Response | undefined => {
    const accept = request.headers.get("accept"),
      declaredBodyByteLength = Number(request.headers.get("content-length")),
      headerByteLength = computeHeaderByteLength(request);
    if (request.url.length > limits.maximumUrlLength) {
      return requestFailureResponse(
        new RequestFailureError("UriTooLong", "Request URL exceeds the configured limit", 414),
        requestId,
      );
    }
    if (headerByteLength > limits.maximumHeaderByteLength) {
      return requestFailureResponse(
        new RequestFailureError(
          "HeadersTooLarge",
          "Request headers exceed the configured limit",
          431,
        ),
        requestId,
      );
    }
    if (!isAssetRequest(request) && !acceptsJson(accept)) {
      return requestFailureResponse(
        new RequestFailureError(
          "NotAcceptable",
          "The requested response media type is not available",
          406,
        ),
        requestId,
      );
    }
    if (
      Number.isFinite(declaredBodyByteLength) &&
      declaredBodyByteLength > limits.maximumJsonBodyByteLength
    ) {
      return requestFailureResponse(
        new RequestFailureError("PayloadTooLarge", "Request body exceeds the configured limit", 413),
        requestId,
      );
    }
    return undefined;
  };

export default {
  handleCorsPreflight,
  handleDiscoveryRoute,
  handleOpenApiRoutes,
  validateTransportLimits,
};
