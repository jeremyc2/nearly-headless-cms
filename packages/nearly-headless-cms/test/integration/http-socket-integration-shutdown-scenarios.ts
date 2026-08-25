import {
  Effect,
  HttpTransport,
  expect,
  httpStatusServiceUnavailable,
  successStatus,
} from "./http-socket-integration-scenarios-imports.ts";

// oxlint-disable-next-line eslint/max-lines-per-function -- [EH-254] shutdown scenario keeps orchestration in one place for readability.
export const verifyShutdownRejectsNewRequests = (): Promise<void> => {
  // oxlint-disable-next-line eslint/sort-vars -- [EH-274] shutdown scenario locals follow handler, server, and request order.
  const drainWindowMultiplier = 4,
    preShutdownDelayMilliseconds = 10,
    slowHandlerDelayMilliseconds = 250,
    // oxlint-disable-next-line eslint/sort-vars -- [EH-275] slow handler factory precedes lifecycle and server setup.
    makeSlowHandler = (): HttpTransport.Handler => () =>
      // oxlint-disable-next-line effecttsgo/new-promise -- [EH-253] slow handler simulates an in-flight socket request outside Effect.
      new Promise((resolve) => {
        // oxlint-disable-next-line effecttsgo/global-timers -- [EH-250] slow handler delay mirrors a peer that keeps the connection open.
        setTimeout(() => {
          resolve(new Response("slow"));
        }, slowHandlerDelayMilliseconds);
      }),
    // oxlint-disable-next-line eslint/sort-vars -- [EH-269] lifecycle construction follows slow handler setup.
    lifecycle = HttpTransport.createTransportLifecycle({
      drainTimeoutMilliseconds: slowHandlerDelayMilliseconds * drainWindowMultiplier,
    }),
    // oxlint-disable-next-line eslint/sort-vars -- [EH-273] server startup follows lifecycle construction.
    server = Bun.serve({
      fetch: (request) => lifecycle.wrapHandler(makeSlowHandler())(request),
      port: 0,
    }),
    // oxlint-disable-next-line effecttsgo/global-fetch -- [EH-245] integration test exercises an in-flight request during shutdown drain.
    slowRequest = fetch(`${server.url.href}slow`);
  // oxlint-disable-next-line effecttsgo/new-promise -- [EH-252] shutdown timing is coordinated through Promise composition in the socket test.
  return new Promise<void>((resolve, reject) => {
    // oxlint-disable-next-line effecttsgo/global-timers -- [EH-249] pre-shutdown delay starts drain while the slow request remains active.
    setTimeout(() => {
      const closePromise = lifecycle
        .close({
          onForceStop: () => {
            void server.stop(true);
          },
        })
        .pipe(Effect.runPromise);
      // oxlint-disable-next-line effecttsgo/global-fetch -- [EH-246] integration test exercises rejection during shutdown drain.
      void fetch(`${server.url.href}slow`)
        .then((rejectedResponse) =>
          Promise.all([slowRequest, closePromise]).then(([slowResponse]) => {
            expect(slowResponse.status).toBe(successStatus);
            expect(rejectedResponse.status).toBe(httpStatusServiceUnavailable);
            expect(server.pendingRequests).toBe(0);
            resolve();
          }),
        )
        .catch(reject);
    }, preShutdownDelayMilliseconds);
  });
};
