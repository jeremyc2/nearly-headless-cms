import { Effect, Schema } from "effect";
import {
  contentTooLargeStatus,
  headerLengthLimit,
  headerTooLargeStatus,
  maximumHeaderByteLength,
  maximumJsonBodyByteLength,
  methodNotAllowedStatus,
  notAcceptableStatus,
  readJsonCode,
  requestTimeoutMilliseconds,
  requestTimeoutStatus,
  snapshot,
  unsupportedMediaTypeStatus,
  uriTooLongStatus,
  urlLengthLimit,
} from "./http-contract-support.ts";
import { DevelopmentCms } from "../../src/testing/index.ts";
import { HttpTransport } from "../../src/http/index.ts";
import { expect } from "bun:test";

type TransportHandler = (request: Request) => Response | Promise<Response>;

const makeLimitsHandler = (): Promise<TransportHandler> => {
    const handlerEffect = HttpTransport.makeHandler({
      deliveryOperations: [
        {
          definitionRequirements: [],
          execute: () => Effect.succeed({ accepted: true }),
          identifier: "submit",
          method: "POST",
          path: "/submissions",
          reachableContentTypeIds: ["post"],
          schemas: {
            request: Schema.Struct({}),
            response: Schema.Struct({ accepted: Schema.Boolean }),
          },
        },
      ],
      maximumHeaderByteLength,
      maximumJsonBodyByteLength,
      maximumUrlLength: headerLengthLimit,
    }).pipe(
      // oxlint-disable-next-line effecttsgo/strict-effect-provide -- test entry point needs a fresh isolated layer.
      Effect.provide(DevelopmentCms.layer({ snapshot })),
    );
    return Effect.runPromise(handlerEffect);
  },
  makeTimeoutHandler = (): Promise<TransportHandler> => {
    const handlerEffect = HttpTransport.makeHandler({
      deliveryOperations: [
        {
          definitionRequirements: [],
          execute: () => Effect.never,
          identifier: "waitForever",
          method: "GET",
          path: "/wait-forever",
          reachableContentTypeIds: ["post"],
          schemas: { request: Schema.Struct({}), response: Schema.Struct({}) },
        },
      ],
      requestTimeoutMilliseconds,
    }).pipe(
      // oxlint-disable-next-line effecttsgo/strict-effect-provide -- test entry point needs a fresh isolated layer.
      Effect.provide(DevelopmentCms.layer({ snapshot })),
    );
    return Effect.runPromise(handlerEffect);
  },
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- HTTP contract assertions intentionally await native promises.
  runTransportLimitsContract = async (): Promise<void> => {
    const limitsHandler = await makeLimitsHandler();
    await verifyPayloadTooLarge(limitsHandler);
    await verifyUnsupportedMedia(limitsHandler);
    await verifyWrongMethod(limitsHandler);
    await verifyLongUrl(limitsHandler);
    await verifyLargeHeaders(limitsHandler);
    await verifyNotAcceptable(limitsHandler);
    await verifyRequestTimeout(await makeTimeoutHandler());
  },
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- HTTP contract assertions intentionally await native promises.
  verifyLargeHeaders = async (handler: TransportHandler): Promise<void> => {
    const largeHeaders = await handler(
      new Request("http://cms.test/api/v1/headless/schema", {
        headers: { "x-large": "x".repeat(headerLengthLimit) },
      }),
    );
    expect(largeHeaders.status).toBe(headerTooLargeStatus);
  },
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- HTTP contract assertions intentionally await native promises.
  verifyLongUrl = async (handler: TransportHandler): Promise<void> => {
    const longUrl = await handler(
      new Request(`http://cms.test/api/v1/headless/${"x".repeat(urlLengthLimit)}`),
    );
    expect(longUrl.status).toBe(uriTooLongStatus);
  },
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- HTTP contract assertions intentionally await native promises.
  verifyNotAcceptable = async (handler: TransportHandler): Promise<void> => {
    const unacceptable = await handler(
      new Request("http://cms.test/api/v1/headless/schema", {
        headers: { accept: "text/csv" },
      }),
    );
    expect(unacceptable.status).toBe(notAcceptableStatus);
    expect(await readJsonCode(unacceptable)).toBe("NotAcceptable");
  },
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- HTTP contract assertions intentionally await native promises.
  verifyPayloadTooLarge = async (handler: TransportHandler): Promise<void> => {
    const oversizedBody = await handler(
      new Request(
        "http://cms.test/api/v1/management/definition-spaces/example-blog/content-types/post/entries",
        {
          body: JSON.stringify({ values: { title: "This body is deliberately too large" } }),
          headers: { "content-type": "application/json" },
          method: "POST",
        },
      ),
    );
    expect(oversizedBody.status).toBe(contentTooLargeStatus);
    expect(await readJsonCode(oversizedBody)).toBe("PayloadTooLarge");
  },
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- HTTP contract assertions intentionally await native promises.
  verifyRequestTimeout = async (handler: TransportHandler): Promise<void> => {
    const timeoutResponse = await handler(new Request("http://cms.test/api/v1/headless/wait-forever"));
    expect(timeoutResponse.status).toBe(requestTimeoutStatus);
    expect(await readJsonCode(timeoutResponse)).toBe("RequestTimeout");
  },
  verifyTransportLimits = (): Promise<void> => runTransportLimitsContract(),
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- HTTP contract assertions intentionally await native promises.
  verifyUnsupportedMedia = async (handler: TransportHandler): Promise<void> => {
    const unsupportedMedia = await handler(
      new Request("http://cms.test/api/v1/headless/submissions", {
        body: "plain text",
        headers: { "content-type": "text/plain" },
        method: "POST",
      }),
    );
    expect(unsupportedMedia.status).toBe(unsupportedMediaTypeStatus);
  },
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- HTTP contract assertions intentionally await native promises.
  verifyWrongMethod = async (handler: TransportHandler): Promise<void> => {
    const wrongMethod = await handler(new Request("http://cms.test/api/v1/headless/submissions"));
    expect(wrongMethod.status).toBe(methodNotAllowedStatus);
  };

export { verifyTransportLimits };
