import {
  DevelopmentCms,
  Duration,
  Effect,
  HttpTransport,
  Schema,
  expect,
  snapshot,
  startBunHttpTransport,
} from "./http-socket-integration-disconnect-scenarios-imports.ts";

const clientAbortDelayMilliseconds = 25,
  slowHandlerEffect = HttpTransport.makeHandler({
    deliveryOperations: [
      {
        definitionRequirements: [],
        execute: () => Effect.never,
        identifier: "slow",
        method: "GET",
        path: "/slow",
        reachableContentTypeIds: ["post"],
        schemas: { request: Schema.Struct({}), response: Schema.Struct({}) },
      },
    ],
  }).pipe(
    // oxlint-disable-next-line effecttsgo/strict-effect-provide -- [EH-112] test entry point needs a fresh isolated layer.
    Effect.provide(DevelopmentCms.layer({ snapshot })),
  ),
  verifyClientDisconnectReleasesLiveSocket = (): Promise<void> =>
    Effect.runPromise(
      slowHandlerEffect.pipe(Effect.flatMap((handler) => startBunHttpTransport({ handler }))),
    ).then((transport) => {
      const abortController = new AbortController();
      void Effect.runPromise(
        Effect.sleep(Duration.millis(clientAbortDelayMilliseconds)).pipe(
          Effect.tap(() => Effect.sync(() =>{  abortController.abort(); })),
        ),
      );
      // oxlint-disable-next-line effecttsgo/global-fetch -- [EH-288] integration test aborts an in-flight request against the live HTTP listener.
      return fetch(`${transport.address}api/v1/headless/slow`, { signal: abortController.signal })
        .then(() => {
          throw new Error("Expected client disconnect to abort the in-flight request");
        })
        .catch((error: unknown) => {
          expect(error).toMatchObject({ name: "AbortError" });
          return Effect.runPromise(transport.close);
        })
        .then(() => {});
    });

export { verifyClientDisconnectReleasesLiveSocket };
