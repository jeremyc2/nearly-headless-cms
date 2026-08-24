import type { DeliveryOperation, ManagementOperation } from "./http-contract.ts";
import type { Options, RouteHandlerContext } from "./http-transport-types.ts";
import { InvalidInput } from "../cms-error.ts";
import { RequestFailureError } from "./http-transport-request-failure.ts";
import transportOperation from "./http-transport-operation.ts";
import transportResponse from "./http-transport-response.ts";

interface CustomManagementMatch {
  readonly operation: ManagementOperation;
  readonly parameters: Readonly<Record<string, string>>;
}

interface DeliveryMatch {
  readonly match: RegExpExecArray;
  readonly matcher: DeliveryOperationMatcher;
}

interface DeliveryOperationResponseOptions {
  readonly cacheControl?: string;
  readonly successStatus?: number;
}

interface DeliveryOperationMatcher {
  readonly expression: RegExp;
  readonly names: readonly string[];
  readonly operation: NonNullable<Options["deliveryOperations"]>[number];
}

const { bodylessResponse, errorResponse, jsonResponse, requestFailureResponse } = transportResponse,
  { executeOperation, matchPath } = transportOperation,
  buildDeliveryParameters = (deliveryMatch: DeliveryMatch): Record<string, string> =>
    Object.fromEntries(
      deliveryMatch.matcher.names.map((name, index) => [
        name,
        decodeURIComponent(deliveryMatch.match[index + 1] ?? ""),
      ]),
    ),
  deliveryOperationResponse = (
    context: RouteHandlerContext,
    value: unknown,
    options: DeliveryOperationResponseOptions,
  ): Response => {
    if (value instanceof Response) {
      return value;
    }
    if (value === undefined) {
      return bodylessResponse(204, context.requestId, context.fingerprint);
    }
    return jsonResponse({
      cacheControl: options.cacheControl ?? "no-cache",
      fingerprint: context.fingerprint,
      requestId: context.requestId,
      status: options.successStatus ?? 200,
      value,
    });
  },
  executeMatchedDeliveryOperation = (
    context: RouteHandlerContext,
    deliveryMatch: DeliveryMatch,
  ): Promise<Response> => {
    const parameters = buildDeliveryParameters(deliveryMatch);
    return context.withOutcome(
      executeOperation(deliveryMatch.matcher.operation, {
        cms: context.cms,
        parameters,
        request: context.request,
        requestId: context.requestId,
        snapshot: context.snapshot,
      }),
      context.requestId,
      (value) =>
        deliveryOperationResponse(context, value, {
          cacheControl: deliveryMatch.matcher.operation.cacheControl,
          successStatus: deliveryMatch.matcher.operation.successStatus,
        }),
    );
  },
  findCustomManagementMatch = (
    context: RouteHandlerContext,
    managementOperations: readonly ManagementOperation[],
  ): CustomManagementMatch | undefined => {
    for (const managementOperation of managementOperations) {
      const parameters = matchPath(
        `${context.managementBase}${managementOperation.path}`,
        context.requestUrl.pathname,
      );
      if (parameters !== undefined) {
        return { operation: managementOperation, parameters };
      }
    }
    return undefined;
  },
  findDeliveryMatcher = (
    context: RouteHandlerContext,
    operationMatchers: readonly DeliveryOperationMatcher[],
  ): DeliveryMatch | undefined => {
    for (const matcher of operationMatchers) {
      const match = matcher.expression.exec(context.requestUrl.pathname);
      if (match !== null && context.request.method === matcher.operation.method) {
        return { match, matcher };
      }
    }
    return undefined;
  },
  handleMatchedDeliveryOperation = (
    context: RouteHandlerContext,
    deliveryMatch: DeliveryMatch,
  ): Response | Promise<Response> => {
    const validationResponse = validateDeliveryRequest(context, deliveryMatch.matcher.operation);
    if (validationResponse !== undefined) {
      return Promise.resolve(validationResponse);
    }
    return executeMatchedDeliveryOperation(context, deliveryMatch);
  },
  methodNotAllowedResponse = (context: RouteHandlerContext): Response =>
    jsonResponse({
      requestId: context.requestId,
      status: 405,
      value: {
        code: "MethodNotAllowed",
        message: "Method not allowed",
        requestId: context.requestId,
      },
    }),
  operationResponse = (context: RouteHandlerContext, value: unknown): Response => {
    if (value instanceof Response) {
      return value;
    }
    if (value === undefined) {
      return bodylessResponse(204, context.requestId, context.fingerprint);
    }
    return jsonResponse({
      fingerprint: context.fingerprint,
      requestId: context.requestId,
      status: 200,
      value,
    });
  },
  resolveUnmatchedDeliveryRoute = (
    context: RouteHandlerContext,
    operationMatchers: readonly DeliveryOperationMatcher[],
  ): Response | undefined | Promise<Response | undefined> => {
    if (operationMatchers.some((matcher) => matcher.expression.test(context.requestUrl.pathname))) {
      return Promise.resolve(methodNotAllowedResponse(context));
    }
    return undefined;
  },
  validateDeliveryContentType = (context: RouteHandlerContext): Response | undefined => {
    if (
      context.request.method === "POST" &&
      !(context.request.headers.get("content-type") ?? "")
        .toLowerCase()
        .startsWith("application/json")
    ) {
      return requestFailureResponse(
        new RequestFailureError(
          "UnsupportedMediaType",
          "Delivery command requires application/json",
          415,
        ),
        context.requestId,
      );
    }
    return undefined;
  },
  validateDeliveryIdempotencyKey = (
    context: RouteHandlerContext,
    operation: DeliveryOperation,
  ): Response | undefined => {
    if (
      operation.requiresIdempotencyKey === true &&
      (context.request.headers.get("idempotency-key")?.length ?? 0) === 0
    ) {
      return errorResponse(
        InvalidInput.make({ message: "Idempotency-Key is required" }),
        context.requestId,
      );
    }
    return undefined;
  },
  validateDeliveryRequest = (
    context: RouteHandlerContext,
    operation: DeliveryOperation,
  ): Response | undefined => {
    const contentTypeResponse = validateDeliveryContentType(context);
    if (contentTypeResponse !== undefined) {
      return contentTypeResponse;
    }
    return validateDeliveryIdempotencyKey(context, operation);
  };

export default {
  executeMatchedDeliveryOperation,
  findCustomManagementMatch,
  findDeliveryMatcher,
  handleMatchedDeliveryOperation,
  methodNotAllowedResponse,
  operationResponse,
  resolveUnmatchedDeliveryRoute,
  validateDeliveryRequest,
};
