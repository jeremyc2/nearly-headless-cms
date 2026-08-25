import type { DeliveryOperation, ManagementOperation } from "./http-contract.ts";
import {
  httpStatusMethodNotAllowed,
  httpStatusNoContent,
  httpStatusOk,
  httpStatusUnsupportedMediaType,
} from "./http-status-codes.ts";
import { InvalidInput } from "../cms-error.ts";
import { RequestFailureError } from "./http-transport-request-failure.ts";
import type { RouteHandlerContext } from "./http-transport-types.ts";
import transportOperation from "./http-transport-operation.ts";
import transportResponse from "./http-transport-response.ts";

interface CustomManagementMatch<Operation extends ManagementOperation> {
  readonly operation: Operation;
  readonly parameters: Readonly<Record<string, string>>;
}

interface DeliveryMatch<Operation extends DeliveryOperation = DeliveryOperation> {
  readonly captures: readonly string[];
  readonly matcher: Readonly<DeliveryOperationMatcher<Operation>>;
}

interface DeliveryOperationResponseOptions {
  readonly cacheControl?: string;
  readonly successStatus?: number;
}

interface DeliveryOperationMatcher<Operation extends DeliveryOperation = DeliveryOperation> {
  readonly expression: Readonly<RegExp>;
  readonly names: readonly string[];
  readonly operation: Readonly<Operation>;
}

const { bodylessResponse, errorResponse, jsonResponse, requestFailureResponse } = transportResponse,
  { executeOperation, matchPath } = transportOperation,
  buildDeliveryParameters = <Operation extends DeliveryOperation>(
    deliveryMatch: Readonly<DeliveryMatch<Operation>>,
  ): Record<string, string> =>
    Object.fromEntries(
      deliveryMatch.matcher.names.map((name, index) => [
        name,
        decodeURIComponent(deliveryMatch.captures[index] ?? ""),
      ]),
    ),
  deliveryOperationResponse = (
    context: Readonly<RouteHandlerContext>,
    value: unknown,
    options: Readonly<DeliveryOperationResponseOptions>,
  ): Response => {
    if (value instanceof Response) {
      return value;
    }
    if (value === undefined) {
      return bodylessResponse(httpStatusNoContent, context.requestId, context.fingerprint);
    }
    return jsonResponse({
      cacheControl: options.cacheControl ?? "no-cache",
      fingerprint: context.fingerprint,
      requestId: context.requestId,
      status: options.successStatus ?? httpStatusOk,
      value,
    });
  },
  executeMatchedDeliveryOperation = <Operation extends DeliveryOperation>(
    context: Readonly<RouteHandlerContext>,
    deliveryMatch: Readonly<DeliveryMatch<Operation>>,
  ): Promise<Response> => {
    const parameters = buildDeliveryParameters(deliveryMatch);
    return context.withOutcome(
      () =>
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
  findCustomManagementMatch = <Operation extends ManagementOperation>(
    context: Readonly<RouteHandlerContext>,
    managementOperations: readonly Operation[],
  ): CustomManagementMatch<Operation> | undefined => {
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
  findDeliveryMatcher = <Operation extends DeliveryOperation>(
    context: Readonly<RouteHandlerContext>,
    operationMatchers: readonly DeliveryOperationMatcher<Operation>[],
  ): DeliveryMatch<Operation> | undefined => {
    for (const matcher of operationMatchers) {
      const match = matcher.expression.exec(context.requestUrl.pathname);
      if (match !== null && context.request.method === matcher.operation.method) {
        return { captures: match.slice(1), matcher };
      }
    }
    return undefined;
  },
  handleMatchedDeliveryOperation = <Operation extends DeliveryOperation>(
    context: Readonly<RouteHandlerContext>,
    deliveryMatch: Readonly<DeliveryMatch<Operation>>,
  ): Response | Promise<Response> => {
    const validationResponse = validateDeliveryRequest(context, deliveryMatch.matcher.operation);
    if (validationResponse !== undefined) {
      return Promise.resolve(validationResponse);
    }
    return executeMatchedDeliveryOperation(context, deliveryMatch);
  },
  methodNotAllowedResponse = (context: Readonly<RouteHandlerContext>): Response =>
    jsonResponse({
      requestId: context.requestId,
      status: httpStatusMethodNotAllowed,
      value: {
        code: "MethodNotAllowed",
        message: "Method not allowed",
        requestId: context.requestId,
      },
    }),
  operationResponse = (context: Readonly<RouteHandlerContext>, value: unknown): Response => {
    if (value instanceof Response) {
      return value;
    }
    if (value === undefined) {
      return bodylessResponse(httpStatusNoContent, context.requestId, context.fingerprint);
    }
    return jsonResponse({
      fingerprint: context.fingerprint,
      requestId: context.requestId,
      status: httpStatusOk,
      value,
    });
  },
  resolveUnmatchedDeliveryRoute = <Operation extends DeliveryOperation>(
    context: Readonly<RouteHandlerContext>,
    operationMatchers: readonly DeliveryOperationMatcher<Operation>[],
  ): Response | undefined | Promise<Response | undefined> => {
    if (operationMatchers.some((matcher) => matcher.expression.test(context.requestUrl.pathname))) {
      return Promise.resolve(methodNotAllowedResponse(context));
    }
    return undefined;
  },
  validateDeliveryContentType = (context: Readonly<RouteHandlerContext>): Response | undefined => {
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
          httpStatusUnsupportedMediaType,
        ),
        context.requestId,
      );
    }
    return undefined;
  },
  validateDeliveryIdempotencyKey = <
    Operation extends Pick<DeliveryOperation, "requiresIdempotencyKey">,
  >(
    context: Readonly<RouteHandlerContext>,
    operation: Readonly<Operation>,
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
  validateDeliveryRequest = <Operation extends Pick<DeliveryOperation, "requiresIdempotencyKey">>(
    context: Readonly<RouteHandlerContext>,
    operation: Readonly<Operation>,
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
