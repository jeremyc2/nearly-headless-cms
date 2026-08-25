import * as HttpApiContract from "./http-api.ts";
import { type Options, type RouteHandlerContext } from "./http-transport-types.ts";
import { discovery, headlessPrefix, managementPrefix } from "./http-contract.ts";
import {
  httpStatusForbidden,
  httpStatusNoContent,
  httpStatusNotModified,
  httpStatusOk,
} from "./http-status-codes.ts";
import type { ReadonlyTransportRequest } from "./http-transport-readonly-types.ts";
import transportPreflightLimits from "./http-transport-preflight-limits-support.ts";
import transportResponse from "./http-transport-response.ts";

interface TransportLimits {
  readonly maximumHeaderByteLength: number;
  readonly maximumJsonBodyByteLength: number;
  readonly maximumUrlLength: number;
}

const { bodylessResponse, jsonResponse, requestFailureResponse } = transportResponse,
  handleCorsPreflight = <RequestType extends ReadonlyTransportRequest, OptionsType extends Options>(
    request: Readonly<RequestType>,
    requestId: string,
    options: Readonly<OptionsType>,
  ): Response | undefined => {
    if (request.method !== "OPTIONS" || options.cors === undefined) {
      return undefined;
    }
    const origin = request.headers.get("origin");
    if (origin === null || !options.cors.origins.includes(origin)) {
      return bodylessResponse(httpStatusForbidden, requestId);
    }
    return new Response(null, {
      headers: {
        "access-control-allow-headers": options.cors.headers.join(", "),
        "access-control-allow-methods": options.cors.methods.join(", "),
        "access-control-allow-origin": origin,
        vary: "Origin",
        "x-request-id": requestId,
      },
      status: httpStatusNoContent,
    });
  },
  handleDiscoveryRoute = (
    context: Readonly<RouteHandlerContext>,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-164] discovery routes read configured operations without mutation.
    operations: Readonly<NonNullable<Options["deliveryOperations"]>>,
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
      return new Response(null, { headers, status: httpStatusNotModified });
    }
    return Response.json(discovery({ operations, snapshot: context.snapshot }), {
      headers,
      status: httpStatusOk,
    });
  },
  handleOpenApiRoutes = (
    context: Readonly<RouteHandlerContext>,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-195] OpenAPI routes read configured operations without mutation.
    operations: Readonly<NonNullable<Options["deliveryOperations"]>>,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-195] OpenAPI routes read configured operations without mutation.
    managementOperations: Readonly<NonNullable<Options["managementOperations"]>>,
  ): Response | undefined => {
    if (
      context.requestUrl.pathname === `${managementPrefix}/openapi.json` &&
      context.request.method === "GET"
    ) {
      return jsonResponse({
        fingerprint: context.fingerprint,
        requestId: context.requestId,
        status: httpStatusOk,
        value: HttpApiContract.managementDocument(managementOperations),
      });
    }
    if (
      context.requestUrl.pathname === `${headlessPrefix}/openapi.json` &&
      context.request.method === "GET"
    ) {
      return jsonResponse({
        cacheControl: "no-cache",
        fingerprint: context.fingerprint,
        requestId: context.requestId,
        status: httpStatusOk,
        value: HttpApiContract.headlessDocument(operations),
      });
    }
    return undefined;
  },
  validateTransportLimits = <
    RequestType extends ReadonlyTransportRequest,
    Limits extends TransportLimits,
  >(
    request: Readonly<RequestType>,
    requestId: string,
    limits: Readonly<Limits>,
  ): Response | undefined => {
    const accept = request.headers.get("accept"),
      declaredBodyByteLength = Number(request.headers.get("content-length")),
      limitFailures = [
        transportPreflightLimits.validateUrlLength(request, limits.maximumUrlLength),
        transportPreflightLimits.validateHeaderByteLength(request, limits.maximumHeaderByteLength),
        transportPreflightLimits.validateJsonAccept(request, accept),
        transportPreflightLimits.validateJsonBodyByteLength(
          declaredBodyByteLength,
          limits.maximumJsonBodyByteLength,
        ),
      ];
    for (const limitFailure of limitFailures) {
      if (limitFailure !== undefined) {
        return requestFailureResponse(limitFailure, requestId);
      }
    }
    return undefined;
  };

export default {
  handleCorsPreflight,
  handleDiscoveryRoute,
  handleOpenApiRoutes,
  validateTransportLimits,
};
