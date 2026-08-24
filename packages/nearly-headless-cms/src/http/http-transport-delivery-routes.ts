import { InvalidInput } from "../cms-error.ts";
import type { ManagementOperation } from "./http-contract.ts";
import transportOperation from "./http-transport-operation.ts";
import transportResponse from "./http-transport-response.ts";
import { RequestFailureError } from "./http-transport-request-failure.ts";
import type { Options, RouteHandlerContext } from "./http-transport-types.ts";

const { bodylessResponse, errorResponse, jsonResponse, requestFailureResponse } = transportResponse,
  { executeOperation, matchPath } = transportOperation,
  operationResponse = (
    context: RouteHandlerContext,
    value: unknown,
  ): Response => {
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
  deliveryOperationResponse = (
    context: RouteHandlerContext,
    value: unknown,
    cacheControl: string | undefined,
    successStatus: number | undefined,
  ): Response => {
    if (value instanceof Response) {
      return value;
    }
    if (value === undefined) {
      return bodylessResponse(204, context.requestId, context.fingerprint);
    }
    return jsonResponse({
      cacheControl: cacheControl ?? "no-cache",
      fingerprint: context.fingerprint,
      requestId: context.requestId,
      status: successStatus ?? 200,
      value,
    });
  },
  findCustomManagementMatch = (
    context: RouteHandlerContext,
    managementOperations: readonly ManagementOperation[],
  ):
    | { readonly operation: ManagementOperation; readonly parameters: Readonly<Record<string, string>> }
    | undefined => {
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
  handleCustomManagementOperations = (
    context: RouteHandlerContext,
    managementOperations: NonNullable<Options["managementOperations"]>,
  ): Response | undefined | Promise<Response | undefined> => {
    const match = findCustomManagementMatch(context, managementOperations);
    if (match === undefined) {
      return undefined;
    }
    if (context.request.method !== match.operation.method) {
      return Promise.resolve(
        jsonResponse({
          requestId: context.requestId,
          status: 405,
          value: {
            code: "MethodNotAllowed",
            message: "Method not allowed",
            requestId: context.requestId,
          },
        }),
      );
    }
    return context.withOutcome(
      executeOperation(match.operation, {
        cms: context.cms,
        parameters: match.parameters,
        request: context.request,
        requestId: context.requestId,
        snapshot: context.snapshot,
      }),
      context.requestId,
      (value) => operationResponse(context, value),
    );
  },
  findDeliveryMatcher = (
    context: RouteHandlerContext,
    operationMatchers: readonly {
      readonly expression: RegExp;
      readonly names: readonly string[];
      readonly operation: NonNullable<Options["deliveryOperations"]>[number];
    }[],
  ):
    | {
        readonly match: RegExpExecArray;
        readonly matcher: (typeof operationMatchers)[number];
      }
    | undefined => {
    for (const matcher of operationMatchers) {
      const match = matcher.expression.exec(context.requestUrl.pathname);
      if (match !== null && context.request.method === matcher.operation.method) {
        return { match, matcher };
      }
    }
    return undefined;
  },
  handleDeliveryOperations = (
    context: RouteHandlerContext,
    operationMatchers: readonly {
      readonly expression: RegExp;
      readonly names: readonly string[];
      readonly operation: NonNullable<Options["deliveryOperations"]>[number];
    }[],
  ): Response | undefined | Promise<Response | undefined> => {
    const deliveryMatch = findDeliveryMatcher(context, operationMatchers);
    if (deliveryMatch === undefined) {
      if (operationMatchers.some((matcher) => matcher.expression.test(context.requestUrl.pathname))) {
        return Promise.resolve(
          jsonResponse({
            requestId: context.requestId,
            status: 405,
            value: {
              code: "MethodNotAllowed",
              message: "Method not allowed",
              requestId: context.requestId,
            },
          }),
        );
      }
      return undefined;
    }
    if (
      context.request.method === "POST" &&
      !(context.request.headers.get("content-type") ?? "")
        .toLowerCase()
        .startsWith("application/json")
    ) {
      return Promise.resolve(
        requestFailureResponse(
          new RequestFailureError(
            "UnsupportedMediaType",
            "Delivery command requires application/json",
            415,
          ),
          context.requestId,
        ),
      );
    }
    if (
      deliveryMatch.matcher.operation.requiresIdempotencyKey === true &&
      (context.request.headers.get("idempotency-key")?.length ?? 0) === 0
    ) {
      return Promise.resolve(
        errorResponse(
          InvalidInput.make({ message: "Idempotency-Key is required" }),
          context.requestId,
        ),
      );
    }
    const parameters = Object.fromEntries(
      deliveryMatch.matcher.names.map((name, index) => [
        name,
        decodeURIComponent(deliveryMatch.match[index + 1] ?? ""),
      ]),
    );
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
        deliveryOperationResponse(
          context,
          value,
          deliveryMatch.matcher.operation.cacheControl,
          deliveryMatch.matcher.operation.successStatus,
        ),
    );
  };

export default {
  handleCustomManagementOperations,
  handleDeliveryOperations,
};
