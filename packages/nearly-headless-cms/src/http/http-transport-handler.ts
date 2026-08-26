import { Service as CmsService, type ServiceShape as CmsServiceShape } from "../cms.ts";
import { type DeliveryOperation, type ManagementOperation } from "./http-contract.ts";
import { type Handler, type Options, type RouteHandlerContext } from "./http-transport-types.ts";
import {
  type ReadonlyTransportAbortSignal,
  type ReadonlyTransportHandlerRequest,
  type ReadonlyTransportUrl,
} from "./http-transport-readonly-types.ts";
import handlerSupport, { type CompiledSnapshot } from "./http-transport-handler-support.ts";
import transportResponse, { httpStatusNotFound } from "./http-transport-response.ts";
import { Effect } from "effect";
import dispatchRouteHandlers from "./http-transport-route-dispatch.ts";
import handleManagementRoutes from "./http-transport-management-routes.ts";
import transportDeliveryRoutes from "./http-transport-delivery-routes.ts";
import transportPreflight from "./http-transport-preflight.ts";
import wrapHandlerWithTimeout from "./http-transport-request-timeout.ts";

type HandlerBodyLimits = ReturnType<typeof handlerSupport.resolveHandlerOptions>["limits"];
type ResolvedHandlerOptions = ReturnType<typeof handlerSupport.resolveHandlerOptions>;

interface DispatchMatchedRoutesInput {
  readonly cms: Readonly<CmsServiceShape>;
  readonly deliveryOperations: readonly DeliveryOperation[];
  readonly limits: HandlerBodyLimits;
  readonly managementOperations: readonly ManagementOperation[];
  readonly operationMatchers: ResolvedHandlerOptions["operationMatchers"];
  readonly options: Readonly<Options>;
  readonly request: ReadonlyTransportHandlerRequest;
  readonly requestId: string;
  readonly requestUrl: ReadonlyTransportUrl;
  readonly signal: ReadonlyTransportAbortSignal;
  readonly snapshot: Readonly<CompiledSnapshot>;
}

interface HandleResolvedRequestInput {
  readonly cms: Readonly<CmsServiceShape>;
  readonly options: Readonly<Options>;
  readonly request: ReadonlyTransportHandlerRequest;
  readonly requestId: string;
  readonly resolved: ResolvedHandlerOptions;
  readonly signal: ReadonlyTransportAbortSignal;
  readonly snapshot: Readonly<CompiledSnapshot>;
}

const { jsonResponse } = transportResponse,
  { applyCorsHeaders, handleCorsPreflight, handleDiscoveryRoute, handleOpenApiRoutes, validateTransportLimits } =
    transportPreflight,
  { handleCustomManagementOperations, handleDeliveryOperations } = transportDeliveryRoutes,
  { buildRouteContext, resolveActiveSnapshot, resolveHandlerOptions } = handlerSupport,
  dispatchManagementAndDeliveryRoutes = (
    routeContext: Readonly<RouteHandlerContext>,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-268] route handlers inspect operation metadata without mutating configured operations.
    managementOperations: readonly ManagementOperation[],
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-268] route handlers inspect operation metadata without mutating configured operations.
    operationMatchers: ResolvedHandlerOptions["operationMatchers"],
  ): Promise<Response | undefined> =>
    dispatchRouteHandlers(
      [
        handleManagementRoutes,
        (context) => handleCustomManagementOperations(context, managementOperations),
        (context) => handleDeliveryOperations(context, operationMatchers),
      ],
      routeContext,
    ),
  dispatchMatchedRoutes = <Input extends DispatchMatchedRoutesInput>(
    input: Readonly<Input>,
  ): Promise<Response | undefined> => {
    const {
        cms,
        deliveryOperations,
        limits,
        managementOperations,
        operationMatchers,
        options,
        request,
        requestId,
        requestUrl,
        signal,
        snapshot,
      } = input,
      corsResponse = handleCorsPreflight(request, requestId, options);
    if (corsResponse !== undefined) {
      return Promise.resolve(corsResponse);
    }
    return dispatchRouteHandlers(
      [
        (context) => handleOpenApiRoutes(context, deliveryOperations, managementOperations),
        (context) => handleDiscoveryRoute(context, deliveryOperations),
        (context) =>
          dispatchManagementAndDeliveryRoutes(context, managementOperations, operationMatchers),
      ],
      buildRouteContext({
        cms,
        limits,
        request,
        requestId,
        requestUrl,
        signal,
        snapshot,
      }),
    );
  },
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-064] request handling awaits route dispatch before returning a final response.
  handleResolvedRequest = async <Input extends HandleResolvedRequestInput>(
    input: Readonly<Input>,
  ): Promise<Response> => {
    const { cms, options, request, requestId, resolved, signal, snapshot } = input,
      matchedResponse = await dispatchMatchedRoutes({
        cms,
        deliveryOperations: resolved.deliveryOperations,
        limits: resolved.limits,
        managementOperations: resolved.managementOperations,
        operationMatchers: resolved.operationMatchers,
        options,
        request,
        requestId,
        requestUrl: new URL(request.url),
        signal,
        snapshot,
      });
    if (matchedResponse !== undefined) {
      return applyCorsHeaders(request, matchedResponse, options);
    }
    return applyCorsHeaders(
      request,
      jsonResponse({
        requestId,
        status: httpStatusNotFound,
        value: { code: "NotFound", message: "Route not found", requestId },
      }),
      options,
    );
  },
  makeHandler = (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-240] handler Options includes requestIdentifier callbacks.
    options?: Options,
  ): Effect.Effect<Handler, never, CmsService> =>
    Effect.gen(function* createHandler() {
      const cms = yield* CmsService,
        resolved = resolveHandlerOptions(options ?? {});
      return wrapHandlerWithTimeout(
        // oxlint-disable-next-line effecttsgo/async-function -- [EH-063] request handling awaits body parsing and Effect execution.
        async (
          request: ReadonlyTransportHandlerRequest,
          signal: ReadonlyTransportAbortSignal,
          requestId: string,
        ): Promise<Response> => {
          const limitResponse = validateTransportLimits(request, requestId, {
              maximumHeaderByteLength: resolved.maximumHeaderByteLength,
              maximumJsonBodyByteLength: resolved.limits.maximumJsonBodyByteLength,
              maximumUrlLength: resolved.maximumUrlLength,
            }),
            snapshot = await resolveActiveSnapshot({ cms, request, requestId, signal });
          if (limitResponse !== undefined) {
            return applyCorsHeaders(request, limitResponse, options ?? {});
          }
          if (snapshot instanceof Response) {
            return applyCorsHeaders(request, snapshot, options ?? {});
          }
          return handleResolvedRequest({
            cms,
            options: options ?? {},
            request,
            requestId,
            resolved,
            signal,
            snapshot,
          });
        },
        resolved.requestIdentifier,
        resolved.requestTimeoutMilliseconds,
      );
    });

/**
 * Creates an interruptible Web handler. It enforces transport limits, validates
 * declared schemas, sanitizes failures, and streams immutable Asset responses.
 */
export type { Handler, Options } from "./http-transport-types.ts";
export { makeHandler };

export default makeHandler;
