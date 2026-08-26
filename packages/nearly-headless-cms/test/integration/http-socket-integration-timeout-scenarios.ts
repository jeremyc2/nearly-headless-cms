import {
  DevelopmentCms,
  Effect,
  HttpTransport,
  Schema,
  expect,
  requestTimeoutMilliseconds,
  requestTimeoutStatus,
  snapshot,
  startBunHttpTransport,
} from "./http-socket-integration-timeout-scenarios-imports.ts";

const timeoutHandlerEffect = HttpTransport.makeHandler({
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
    // oxlint-disable-next-line effecttsgo/strict-effect-provide -- [EH-112] test entry point needs a fresh isolated layer.
    Effect.provide(DevelopmentCms.layer({ snapshot })),
  ),
  verifyRequestTimeoutOverLiveSocket = (): Promise<void> =>
    Effect.runPromise(
      timeoutHandlerEffect.pipe(Effect.flatMap((handler) => startBunHttpTransport({ handler }))),
    ).then((transport) => {
      const requestUrl = `${transport.address}api/v1/headless/wait-forever`;
      return (
        // oxlint-disable-next-line effecttsgo/global-fetch -- [EH-289] integration test exercises request timeout through the live HTTP listener.
        fetch(requestUrl)
      )
        .then((response) => {
          expect(response.status).toBe(requestTimeoutStatus);
          return Effect.runPromise(transport.close);
        })
        .then(() => {});
    });

export { verifyRequestTimeoutOverLiveSocket };
