import * as HttpApiContract from "./http-api.ts";
import { Effect, Layer } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { headlessPrefix, managementPrefix } from "./http-contract.ts";
import makeHandler, { type Handler, type Options } from "./http-transport-handler.ts";
import { HttpApiBuilder } from "effect/unstable/httpapi";

type HeadlessApi = ReturnType<typeof HttpApiContract.headless>;
type ManagementApi = ReturnType<typeof HttpApiContract.management>;

const buildApiHandlers = <OptionsType extends Options>(options: Readonly<OptionsType>) => {
    const headlessApi = HttpApiContract.headless(options.deliveryOperations ?? []),
      headlessHandlers = HttpApiBuilder.group(headlessApi, "headless", (handlers) =>
        makeHandler(options).pipe(
          Effect.map((handler) =>
            handlers.handleAll(buildEndpointMap({ api: headlessApi, handler })),
          ),
        ),
      ),
      managementApi = HttpApiContract.management(options.managementOperations ?? []),
      managementHandlers = HttpApiBuilder.group(managementApi, "management", (handlers) =>
        makeHandler(options).pipe(
          Effect.map((handler) =>
            handlers.handleAll(buildManagementEndpointMap({ api: managementApi, handler })),
          ),
        ),
      );
    return { headlessApi, headlessHandlers, managementApi, managementHandlers };
  },
  buildEndpointMap = <Input extends { readonly api: HeadlessApi; readonly handler: Handler }>(
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
    Input extends { readonly api: ManagementApi; readonly handler: Handler },
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
  layer = <OptionsType extends Options>(options?: Readonly<OptionsType>) => {
    const crossCuttingRoutes = Layer.effectDiscard(
        Effect.gen(function* registerCrossCuttingRoutes() {
          const handler = yield* makeHandler(options ?? {}),
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
  },
  respond = <
    Input extends {
      readonly handler: Handler;
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

/**
 * Creates the configurable, portable Effect HTTP Transport Layer. A CMS Builder
 * provides an Effect HTTP-server adapter when serving these routes.
 */
export { layer };
