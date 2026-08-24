import { Service as CmsService, type ServiceShape as CmsServiceShape } from "../cms.ts";
import { type DeliveryOperation, type ManagementOperation } from "./http-contract.ts";
import { type Handler, type Options, type RouteHandlerContext } from "./http-transport-types.ts";
import handlerSupport, { type CompiledSnapshot } from "./http-transport-handler-support.ts";
import { Effect } from "effect";
import dispatchRouteHandlers from "./http-transport-route-dispatch.ts";
import handleManagementRoutes from "./http-transport-management-routes.ts";
import transportDeliveryRoutes from "./http-transport-delivery-routes.ts";
import transportPreflight from "./http-transport-preflight.ts";
import transportResponse from "./http-transport-response.ts";
import wrapHandlerWithTimeout from "./http-transport-request-timeout.ts";

type HandlerBodyLimits = ReturnType<typeof handlerSupport.resolveHandlerOptions>["limits"];
type ResolvedHandlerOptions = ReturnType<typeof handlerSupport.resolveHandlerOptions>;

interface DispatchMatchedRoutesInput {
  readonly cms: CmsServiceShape;
  readonly deliveryOperations: readonly DeliveryOperation[];
  readonly limits: HandlerBodyLimits;
  readonly managementOperations: readonly ManagementOperation[];
  readonly operationMatchers: ResolvedHandlerOptions["operationMatchers"];
  readonly options: Options;
  readonly request: Request;
  readonly requestId: string;
  readonly requestUrl: URL;
  readonly signal: AbortSignal;
  readonly snapshot: CompiledSnapshot;
}

interface HandleResolvedRequestInput {
  readonly cms: CmsServiceShape;
  readonly options: Options;
  readonly request: Request;
  readonly requestId: string;
  readonly resolved: ResolvedHandlerOptions;
  readonly signal: AbortSignal;
  readonly snapshot: CompiledSnapshot;
}

const { jsonResponse } = transportResponse,
  { handleCorsPreflight, handleDiscoveryRoute, handleOpenApiRoutes, validateTransportLimits } =
    transportPreflight,
  { handleCustomManagementOperations, handleDeliveryOperations } = transportDeliveryRoutes,
  { buildRouteContext, resolveActiveSnapshot, resolveHandlerOptions } = handlerSupport,
  dispatchManagementAndDeliveryRoutes = (
    routeContext: RouteHandlerContext,
    managementOperations: readonly ManagementOperation[],
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
  dispatchMatchedRoutes = ({
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
  }: DispatchMatchedRoutesInput): Promise<Response | undefined> => {
    const corsResponse = handleCorsPreflight(request, requestId, options);
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
  // oxlint-disable-next-line effecttsgo/async-function -- request handling awaits route dispatch before returning a final response.
  handleResolvedRequest = async ({
    cms,
    options,
    request,
    requestId,
    resolved,
    signal,
    snapshot,
  }: HandleResolvedRequestInput): Promise<Response> => {
    const matchedResponse = await dispatchMatchedRoutes({
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
      return matchedResponse;
    }
    return jsonResponse({
      requestId,
      status: 404,
      value: { code: "NotFound", message: "Route not found", requestId },
    });
  },
  makeHandler = (options: Options = {}): Effect.Effect<Handler, never, CmsService> =>
    Effect.gen(function* createHandler() {
      const cms = yield* CmsService,
        resolved = resolveHandlerOptions(options);
      return wrapHandlerWithTimeout(
        // oxlint-disable-next-line effecttsgo/async-function -- request handling awaits body parsing and Effect execution.
        async (request: Request, signal: AbortSignal, requestId: string): Promise<Response> => {
          const limitResponse = validateTransportLimits(request, requestId, {
              maximumHeaderByteLength: resolved.maximumHeaderByteLength,
              maximumJsonBodyByteLength: resolved.limits.maximumJsonBodyByteLength,
              maximumUrlLength: resolved.maximumUrlLength,
            }),
            snapshot = await resolveActiveSnapshot({ cms, request, requestId, signal });
          if (limitResponse !== undefined) {
            return limitResponse;
          }
          if (snapshot instanceof Response) {
            return snapshot;
          }
          return handleResolvedRequest({
            cms,
            options,
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
