import { HttpContract, HttpTransport } from "nearly-headless-cms/http";
import * as HttpApiContract from "../../../../../packages/nearly-headless-cms/src/http/http-api.ts";
import { Effect, Layer } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { wrapTransportHandlerWithRequestIdentity } from "./auth-handler-wrapper.ts";

const { headlessPrefix, managementPrefix } = HttpContract,
  buildApiHandlers = <OptionsType extends HttpTransport.Options>(options: Readonly<OptionsType>) => {
    const headlessApi = HttpApiContract.headless(options.deliveryOperations ?? []),
      headlessHandlers = HttpApiBuilder.group(headlessApi, "headless", (handlers) =>
        HttpTransport.makeHandler(options).pipe(
          Effect.map((handler) =>
            handlers.handleAll(
              buildEndpointMap({
                api: headlessApi,
                handler: wrapTransportHandlerWithRequestIdentity(handler),
              }),
            ),
          ),
        ),
      ),
      managementApi = HttpApiContract.management(options.managementOperations ?? []),
      managementHandlers = HttpApiBuilder.group(managementApi, "management", (handlers) =>
        HttpTransport.makeHandler(options).pipe(
          Effect.map((handler) =>
            handlers.handleAll(
              buildManagementEndpointMap({
                api: managementApi,
                handler: wrapTransportHandlerWithRequestIdentity(handler),
              }),
            ),
          ),
        ),
      );
    return { headlessApi, headlessHandlers, managementApi, managementHandlers };
  },
  buildEndpointMap = <
    ApiType extends ReturnType<typeof HttpApiContract.headless>,
    Input extends { readonly api: ApiType; readonly handler: HttpTransport.Handler },
  >(
    input: Readonly<Input>,
  ) =>
    Object.fromEntries(
      Object.keys(input.api.groups["headless"].endpoints).map((identifier) => [
        identifier,
        <RequestInput extends { readonly request: HttpServerRequest.HttpServerRequest }>(
          requestInput: Readonly<RequestInput>,
        ) => respond({ handler: input.handler, request: requestInput.request }),
      ]),
    ),
  buildManagementEndpointMap = <
    ApiType extends ReturnType<typeof HttpApiContract.management>,
    Input extends { readonly api: ApiType; readonly handler: HttpTransport.Handler },
  >(
    input: Readonly<Input>,
  ) =>
    Object.fromEntries(
      Object.keys(input.api.groups["management"].endpoints).map((identifier) => [
        identifier,
        <RequestInput extends { readonly request: HttpServerRequest.HttpServerRequest }>(
          requestInput: Readonly<RequestInput>,
        ) => respond({ handler: input.handler, request: requestInput.request }),
      ]),
    ),
  respond = <
    Input extends {
      readonly handler: HttpTransport.Handler;
      readonly request: HttpServerRequest.HttpServerRequest;
    },
  >(
    input: Readonly<Input>,
  ) =>
    HttpServerRequest.toWeb(input.request).pipe(
      Effect.orDie,
      Effect.flatMap((webRequest) => Effect.promise(() => input.handler(webRequest))),
      Effect.map(HttpServerResponse.fromWeb),
    );

/** HttpTransport.layer with JWT-scoped Current Identity on every CMS request. */
export const authenticatedHttpTransportLayer = <OptionsType extends HttpTransport.Options>(
  options?: Readonly<OptionsType>,
) => {
  const crossCuttingRoutes = Layer.effectDiscard(
      Effect.gen(function* registerCrossCuttingRoutes() {
        const handler = wrapTransportHandlerWithRequestIdentity(
            yield* HttpTransport.makeHandler(options ?? {}),
          ),
          router = yield* HttpRouter.HttpRouter;
        yield* router.add("GET", `${managementPrefix}/openapi.json`, (request) =>
          respond({ handler, request }),
        );
        yield* router.add("GET", `${headlessPrefix}/openapi.json`, (request) =>
          respond({ handler, request }),
        );
        yield* router.add("OPTIONS", "/api/*", (request) => respond({ handler, request }));
      }),
    ),
    declaredRoutes = (() => {
      const resolvedOptions = options ?? {},
        { headlessApi, headlessHandlers, managementApi, managementHandlers } =
          buildApiHandlers(resolvedOptions);
      return Layer.merge(
        HttpApiBuilder.layer(managementApi).pipe(Layer.provide(managementHandlers)),
        HttpApiBuilder.layer(headlessApi).pipe(Layer.provide(headlessHandlers)),
      );
    })();
  return Layer.merge(declaredRoutes, crossCuttingRoutes);
};
