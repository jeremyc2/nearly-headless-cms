import type { CmsError } from "../cms-error.ts";
import { Service as CmsService, type ServiceShape as CmsServiceShape } from "../cms.ts";
import type { CompiledSnapshot } from "../content-definition.ts";
import { Effect } from "effect";
import {
  type DeliveryOperation,
  type ManagementOperation,
  headlessPrefix,
  managementPrefix,
} from "./http-contract.ts";
import type { Handler, Options, RouteHandlerContext } from "./http-transport-types.ts";
import transportDeliveryRoutes from "./http-transport-delivery-routes.ts";
import handleManagementRoutes from "./http-transport-management-routes.ts";
import transportOperation from "./http-transport-operation.ts";
import transportPreflight from "./http-transport-preflight.ts";
import transportRequestParsing from "./http-transport-request-parsing.ts";
import wrapHandlerWithTimeout from "./http-transport-request-timeout.ts";
import transportResponse from "./http-transport-response.ts";

const {
    errorResponse,
    jsonResponse,
    respondWithOutcome,
    runOperationInterruptibly,
  } = transportResponse,
  { compilePath, ensureFingerprint } = transportOperation,
  { parseJson } = transportRequestParsing,
  {
    handleCorsPreflight,
    handleDiscoveryRoute,
    handleOpenApiRoutes,
    validateTransportLimits,
  } = transportPreflight,
  { handleCustomManagementOperations, handleDeliveryOperations } = transportDeliveryRoutes;

interface HandlerBodyLimits {
  readonly maximumJsonBodyByteLength: number;
  readonly maximumMultipartBodyByteLength: number;
  readonly maximumMultipartFileByteLength: number;
  readonly maximumMultipartMetadataByteLength: number;
}

interface ResolvedHandlerOptions {
  readonly deliveryOperations: readonly DeliveryOperation[];
  readonly limits: HandlerBodyLimits;
  readonly managementOperations: readonly ManagementOperation[];
  readonly maximumHeaderByteLength: number;
  readonly maximumUrlLength: number;
  readonly operationMatchers: readonly {
    readonly expression: RegExp;
    readonly names: readonly string[];
    readonly operation: DeliveryOperation;
  }[];
  readonly requestIdentifier: () => string;
  readonly requestTimeoutMilliseconds: number;
}

interface ResolveActiveSnapshotInput {
  readonly cms: CmsServiceShape;
  readonly request: Request;
  readonly requestId: string;
  readonly signal: AbortSignal;
}

interface BuildRouteContextInput {
  readonly cms: CmsServiceShape;
  readonly limits: HandlerBodyLimits;
  readonly request: Request;
  readonly requestId: string;
  readonly requestUrl: URL;
  readonly signal: AbortSignal;
  readonly snapshot: CompiledSnapshot;
}

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

const compileOperationMatcher = (operation: DeliveryOperation) => {
  const compiled = compilePath(`${headlessPrefix}${operation.path}`);
  return { expression: compiled.expression, names: compiled.names, operation };
},
// oxlint-disable-next-line effecttsgo/async-function -- snapshot resolution awaits interruptible Effect execution before routing.
resolveActiveSnapshot = async ({
  cms,
  request,
  requestId,
  signal,
}: ResolveActiveSnapshotInput): Promise<CompiledSnapshot | Response> => {
  const activeOutcome = await runOperationInterruptibly(cms.activeDefinitionSnapshot, signal);
  if (!activeOutcome.success) {
    if (activeOutcome.error === undefined) {
      throw new Error("Operation failed without an error");
    }
    return errorResponse(activeOutcome.error, requestId);
  }
  const snapshot = activeOutcome.value;
  if (snapshot === undefined) {
    throw new Error("Operation succeeded without a value");
  }
  const { fingerprint } = snapshot,
    fingerprintOutcome = await runOperationInterruptibly(
      ensureFingerprint(request, fingerprint),
      signal,
    );
  if (!fingerprintOutcome.success) {
    if (fingerprintOutcome.error === undefined) {
      throw new Error("Fingerprint operation failed without an error");
    }
    return errorResponse(fingerprintOutcome.error, requestId);
  }
  return snapshot;
},
buildRouteContext = ({
  cms,
  limits,
  request,
  requestId,
  requestUrl,
  signal,
  snapshot,
}: BuildRouteContextInput): RouteHandlerContext => ({
  cms,
  fingerprint: snapshot.fingerprint,
  managementBase: `${managementPrefix}/definition-spaces/${encodeURIComponent(snapshot.definitionSpaceId)}`,
  maximumJsonBodyByteLength: limits.maximumJsonBodyByteLength,
  maximumMultipartBodyByteLength: limits.maximumMultipartBodyByteLength,
  maximumMultipartFileByteLength: limits.maximumMultipartFileByteLength,
  maximumMultipartMetadataByteLength: limits.maximumMultipartMetadataByteLength,
  parseJson,
  request,
  requestId,
  requestUrl,
  signal,
  snapshot,
  withOutcome: <Value>(
    effect: Effect.Effect<Value, CmsError>,
    operationRequestId: string,
    success: (value: Value) => Response,
  ): Promise<Response> => respondWithOutcome({ effect, requestId: operationRequestId, signal, success }),
}),
resolveHandlerOptions = (options: Options): ResolvedHandlerOptions => {
  const deliveryOperations = options.deliveryOperations ?? [],
    managementOperations = options.managementOperations ?? [];
  return {
    deliveryOperations,
    limits: {
      maximumJsonBodyByteLength: options.maximumJsonBodyByteLength ?? 1_000_000,
      maximumMultipartBodyByteLength: options.maximumMultipartBodyByteLength ?? 25_000_000,
      maximumMultipartFileByteLength: options.maximumMultipartFileByteLength ?? 20_000_000,
      maximumMultipartMetadataByteLength: options.maximumMultipartMetadataByteLength ?? 64_000,
    },
    managementOperations,
    maximumHeaderByteLength: options.maximumHeaderByteLength ?? 32_768,
    maximumUrlLength: options.maximumUrlLength ?? 8192,
    operationMatchers: deliveryOperations.map(compileOperationMatcher),
    // oxlint-disable-next-line effecttsgo/crypto-random-uuid -- default request IDs are generated synchronously before Effect execution.
    requestIdentifier: options.requestIdentifier ?? (() => crypto.randomUUID()),
    requestTimeoutMilliseconds: options.requestTimeoutMilliseconds ?? 30_000,
  };
},
// oxlint-disable-next-line effecttsgo/async-function -- management and delivery routes delegate to Promise-based handlers sequentially.
dispatchManagementAndDeliveryRoutes = async (
  routeContext: RouteHandlerContext,
  managementOperations: readonly ManagementOperation[],
  operationMatchers: ResolvedHandlerOptions["operationMatchers"],
): Promise<Response | undefined> => {
  const managementResponse = await handleManagementRoutes(routeContext);
  if (managementResponse !== undefined) {
    return managementResponse;
  }
  const customManagementResponse = await handleCustomManagementOperations(
    routeContext,
    managementOperations,
  );
  if (customManagementResponse !== undefined) {
    return customManagementResponse;
  }
  return handleDeliveryOperations(routeContext, operationMatchers);
},
// oxlint-disable-next-line effecttsgo/async-function -- route dispatch awaits Promise-based handlers before falling through.
dispatchMatchedRoutes = async ({
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
  const routeContext = buildRouteContext({
      cms,
      limits,
      request,
      requestId,
      requestUrl,
      signal,
      snapshot,
    }),
    corsResponse = handleCorsPreflight(request, requestId, options),
    discoveryResponse = handleDiscoveryRoute(routeContext, deliveryOperations),
    openApiResponse = handleOpenApiRoutes(routeContext, deliveryOperations, managementOperations);
  if (corsResponse !== undefined) {
    return corsResponse;
  }
  if (openApiResponse !== undefined) {
    return openApiResponse;
  }
  if (discoveryResponse !== undefined) {
    return discoveryResponse;
  }
  return dispatchManagementAndDeliveryRoutes(routeContext, managementOperations, operationMatchers);
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
};

/**
 * Creates an interruptible Web handler. It enforces transport limits, validates
 * declared schemas, sanitizes failures, and streams immutable Asset responses.
 */
export const makeHandler = (options: Options = {}): Effect.Effect<Handler, never, CmsService> =>
  Effect.gen(function* createHandler() {
    const cms = yield* CmsService,
      resolved = resolveHandlerOptions(options),
      // oxlint-disable-next-line effecttsgo/async-function -- request handling awaits body parsing and Effect execution.
      handleRequest = async (request: Request, signal: AbortSignal, requestId: string): Promise<Response> => {
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
        return handleResolvedRequest({ cms, options, request, requestId, resolved, signal, snapshot });
      };
    return wrapHandlerWithTimeout(handleRequest, resolved.requestIdentifier, resolved.requestTimeoutMilliseconds);
  });

export default makeHandler;
