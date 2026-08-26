import {
  DevelopmentCms,
  Effect,
  HttpTransport,
  Schema,
  contentTooLargeStatus,
  expect,
  maximumJsonBodyByteLength,
  readJsonCode,
  snapshot,
  startBunHttpTransport,
} from "./http-socket-integration-body-limit-scenarios-imports.ts";

const limitsHandlerEffect = HttpTransport.makeHandler({
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
    maximumJsonBodyByteLength,
  }  ).pipe(
    // oxlint-disable-next-line effecttsgo/strict-effect-provide -- [EH-162] test entry point needs a fresh isolated layer.
    Effect.provide(DevelopmentCms.layer({ snapshot })),
  ),
  submissionsPath = "api/v1/headless/submissions",
  verifyPayloadTooLargeOverLiveSocket = (): Promise<void> =>
    Effect.runPromise(
      limitsHandlerEffect.pipe(Effect.flatMap((handler) => startBunHttpTransport({ handler }))),
    ).then((transport) => {
      const requestUrl = `${transport.address}${submissionsPath}`;
      return (
        // oxlint-disable-next-line effecttsgo/global-fetch -- [EH-104] integration test exercises JSON body limits through the live HTTP listener.
        fetch(requestUrl, {
          body: JSON.stringify({ values: { title: "This body is deliberately too large" } }),
          headers: { "content-type": "application/json" },
          method: "POST",
        })
      )
        .then((response) => {
          expect(response.status).toBe(contentTooLargeStatus);
          return readJsonCode(response);
        })
        .then((errorCode) => {
          expect(errorCode).toBe("PayloadTooLarge");
          return Effect.runPromise(transport.close);
        })
        .then(() => {});
    });

export { verifyPayloadTooLargeOverLiveSocket };
