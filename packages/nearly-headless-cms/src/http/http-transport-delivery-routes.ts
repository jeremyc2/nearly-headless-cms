import type { Options, RouteHandlerContext } from "./http-transport-types.ts";
import deliveryRouteSupport from "./http-transport-delivery-route-support.ts";
import { httpStatusMethodNotAllowed } from "./http-status-codes.ts";
import transportOperation from "./http-transport-operation.ts";
import transportResponse from "./http-transport-response.ts";

const { executeOperation } = transportOperation,
  { jsonResponse } = transportResponse,
  {
    findCustomManagementMatch,
    findDeliveryMatcher,
    handleMatchedDeliveryOperation,
    operationResponse,
    resolveUnmatchedDeliveryRoute,
  } = deliveryRouteSupport,
  handleCustomManagementOperations = (
    context: Readonly<RouteHandlerContext>,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- route handlers inspect operation metadata without mutating configured operations.
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
          status: httpStatusMethodNotAllowed,
          value: {
            code: "MethodNotAllowed",
            message: "Method not allowed",
            requestId: context.requestId,
          },
        }),
      );
    }
    return context.withOutcome(
      () =>
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
  handleDeliveryOperations = (
    context: Readonly<RouteHandlerContext>,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- route handlers inspect operation metadata without mutating configured operations.
    operationMatchers: readonly {
      readonly expression: RegExp;
      readonly names: readonly string[];
      readonly operation: NonNullable<Options["deliveryOperations"]>[number];
    }[],
  ): Response | undefined | Promise<Response | undefined> => {
    const deliveryMatch = findDeliveryMatcher(context, operationMatchers);
    if (deliveryMatch === undefined) {
      return resolveUnmatchedDeliveryRoute(context, operationMatchers);
    }
    return handleMatchedDeliveryOperation(context, deliveryMatch);
  };

export default {
  handleCustomManagementOperations,
  handleDeliveryOperations,
};
