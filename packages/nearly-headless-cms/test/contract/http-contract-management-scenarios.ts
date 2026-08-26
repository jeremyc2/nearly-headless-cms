import { Effect, Layer, Schema } from "effect";
import { HttpRouter, HttpServer } from "effect/unstable/http";
import { HttpTransport, OpenApi } from "../../src/http/index.ts";
import {
  createdStatus,
  isRecord,
  notFoundStatus,
  snapshot,
  successStatus,
} from "./http-contract-support.ts";
import { DevelopmentCms } from "../../src/testing/index.ts";
import { expect } from "bun:test";

type ManagementHandler = <RequestType extends Request>(
  request: Readonly<RequestType>,
) => Response | Promise<Response>;

const makeManagementHandler = (): Promise<ManagementHandler> => {
    const handlerEffect = HttpTransport.makeHandler({}).pipe(
      // oxlint-disable-next-line effecttsgo/strict-effect-provide -- [EH-162] test entry point needs a fresh isolated layer.
      Effect.provide(DevelopmentCms.layer({ snapshot })),
    );
    return Effect.runPromise(handlerEffect);
  },
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-038] HTTP contract assertions intentionally await native promises.
  runPortableRoutesContract = async (): Promise<void> => {
    const routes = HttpTransport.layer({
        deliveryOperations: [
          {
            definitionRequirements: [],
            execute: () => Effect.succeed({ available: true }),
            identifier: "checkAvailability",
            method: "GET",
            path: "/availability",
            reachableContentTypeIds: ["post"],
            schemas: {
              request: Schema.Struct({}),
              response: Schema.Struct({ available: Schema.Boolean }),
            },
          },
        ],
      }).pipe(
        Layer.provide(DevelopmentCms.layer({ snapshot })),
        Layer.provide(HttpServer.layerServices),
      ),
      webHandler = HttpRouter.toWebHandler(routes);
    try {
      const response = await webHandler.handler(
        new Request("http://cms.test/api/v1/headless/availability"),
      );
      expect(response.status).toBe(successStatus);
      expect(await response.json()).toEqual({ available: true });
    } finally {
      await webHandler.dispose();
    }
  },
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-038] HTTP contract assertions intentionally await native promises.
  runVersionedManagementContract = async (): Promise<void> => {
    const handler = await makeManagementHandler();
    await verifyVersionedManagementRequests(handler);
    expect(OpenApi.management([]).openapi).toBe("3.1.0");
    expect(OpenApi.headless([]).paths).not.toHaveProperty("/content-types/{contentTypeId}/entries");
  },
  verifyPortableHttpApiRoutes = (): Promise<void> => runPortableRoutesContract(),
  verifyVersionedManagementOperations = (): Promise<void> => runVersionedManagementContract(),
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-038] HTTP contract assertions intentionally await native promises.
  verifyVersionedManagementRequests = async (handler: ManagementHandler): Promise<void> => {
    const created = await handler(
        new Request(
          "http://cms.test/api/v1/management/definition-spaces/example-blog/content-types/post/entries",
          {
            body: JSON.stringify({ values: { title: "Hello" } }),
            headers: { "content-type": "application/json" },
            method: "POST",
          },
        ),
      ),
      createdBody: unknown = await created.json(),
      unrestrictedHeadless = await handler(
        new Request("http://cms.test/api/v1/headless/content-types/post/entries"),
      );
    expect(created.status).toBe(createdStatus);
    expect(created.headers.get("cms-definition-fingerprint")).toBe(snapshot.fingerprint);
    if (!isRecord(createdBody) || !isRecord(createdBody["values"])) {
      throw new TypeError("Expected created Entry values");
    }
    expect(createdBody["values"]["title"]).toBe("Hello");
    expect(unrestrictedHeadless.status).toBe(notFoundStatus);
  };

export { verifyPortableHttpApiRoutes, verifyVersionedManagementOperations };
