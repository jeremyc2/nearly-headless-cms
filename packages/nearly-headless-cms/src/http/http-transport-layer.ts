import * as HttpApiContract from "./http-api.ts";
import { Effect, Layer } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { headlessPrefix, managementPrefix } from "./http-contract.ts";
import makeHandler, { type Handler, type Options } from "./http-transport-handler.ts";
import { HttpApiBuilder } from "effect/unstable/httpapi";

const buildApiHandlers = (options: Options) => {
    const headlessApi = HttpApiContract.headless(options.deliveryOperations ?? []),
      headlessHandlers = HttpApiBuilder.group(headlessApi, "headless", (handlers) =>
        makeHandler(options).pipe(
          Effect.map((handler) =>
            handlers.handleAll(
              Object.fromEntries(
                Object.keys(headlessApi.groups["headless"].endpoints).map((identifier) => [
                  identifier,
                  ({ request }: { readonly request: HttpServerRequest.HttpServerRequest }) =>
                    respond(handler, request),
                ]),
              ),
            ),
          ),
        ),
      ),
      managementApi = HttpApiContract.management(options.managementOperations),
      managementHandlers = HttpApiBuilder.group(managementApi, "management", (handlers) =>
        makeHandler(options).pipe(
          Effect.map((handler) =>
            handlers.handleAll(
              Object.fromEntries(
                Object.keys(managementApi.groups["management"].endpoints).map((identifier) => [
                  identifier,
                  ({ request }: { readonly request: HttpServerRequest.HttpServerRequest }) =>
                    respond(handler, request),
                ]),
              ),
            ),
          ),
        ),
      );
    return { headlessApi, headlessHandlers, managementApi, managementHandlers };
  },
  layer = (options: Options = {}) => {
    const { headlessApi, headlessHandlers, managementApi, managementHandlers } = buildApiHandlers(options),
      crossCuttingRoutes = Layer.effectDiscard(
        Effect.gen(function* registerCrossCuttingRoutes() {
          const handler = yield* makeHandler(options),
            router = yield* HttpRouter.HttpRouter;
          yield* router.add("GET", `${managementPrefix}/openapi.json`, (request) =>
            respond(handler, request),
          );
          yield* router.add("GET", `${headlessPrefix}/openapi.json`, (request) =>
            respond(handler, request),
          );
          yield* router.add("OPTIONS", "/api/*", (request) => respond(handler, request));
        }),
      ),
      declaredRoutes = Layer.merge(
        HttpApiBuilder.layer(managementApi).pipe(Layer.provide(managementHandlers)),
        HttpApiBuilder.layer(headlessApi).pipe(Layer.provide(headlessHandlers)),
      );
    return Layer.merge(declaredRoutes, crossCuttingRoutes);
  },
  respond = (handler: Handler, request: HttpServerRequest.HttpServerRequest) =>
    HttpServerRequest.toWeb(request).pipe(
      Effect.orDie,
      Effect.flatMap((webRequest) => Effect.promise(() => handler(webRequest))),
      Effect.map(HttpServerResponse.fromWeb),
    );

/**
 * Creates the configurable, portable Effect HTTP Transport Layer. A CMS Builder
 * provides an Effect HTTP-server adapter when serving these routes.
 */
export { layer };
