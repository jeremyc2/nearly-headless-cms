import {
  Effect,
  HttpTransport,
  expect,
  httpStatusServiceUnavailable,
  successStatus,
} from "./http-socket-integration-scenarios-imports.ts";

// oxlint-disable-next-line eslint/max-lines-per-function -- [EH-170] shutdown scenario keeps orchestration in one place for readability.
export const verifyShutdownRejectsNewRequests = (): Promise<void> => {
  const drainWindowMultiplier = 4,
    slowHandlerDelayMilliseconds = 250,
    slowRequestAcceptancePollMilliseconds = 5,
    slowRequestAcceptanceTimeoutMilliseconds = 2000,
    makeSlowHandler = (): HttpTransport.Handler => () =>
      // oxlint-disable-next-line effecttsgo/new-promise -- [EH-142] slow handler simulates an in-flight socket request outside Effect.
      new Promise((resolve) => {
        // oxlint-disable-next-line effecttsgo/global-timers -- [EH-117] slow handler delay mirrors a peer that keeps the connection open.
        setTimeout(() => {
          resolve(new Response("slow"));
        }, slowHandlerDelayMilliseconds);
      }),
    lifecycle = HttpTransport.createTransportLifecycle({
      drainTimeoutMilliseconds: slowHandlerDelayMilliseconds * drainWindowMultiplier,
    }),
    server = Bun.serve({
      fetch: (request) => lifecycle.wrapHandler(makeSlowHandler())(request),
      port: 0,
    }),
    // oxlint-disable-next-line effecttsgo/global-fetch -- [EH-103] integration test exercises an in-flight request during shutdown drain.
    slowRequest = fetch(`${server.url.href}slow`),
    waitForSlowRequestAcceptance = (): Promise<void> => {
      const deadline = performance.now() + slowRequestAcceptanceTimeoutMilliseconds,
        // oxlint-disable-next-line effecttsgo/async-function -- [EH-073] socket acceptance polling coordinates shutdown timing outside Effect.
        poll = async (): Promise<void> => {
          if (server.pendingRequests > 0) {
            return;
          }
          if (performance.now() >= deadline) {
            throw new Error("Slow request was not accepted before shutdown");
          }
          await Bun.sleep(slowRequestAcceptancePollMilliseconds);
          return poll();
        };
      return poll();
    };
  return waitForSlowRequestAcceptance().then(() => {
    const closePromise = lifecycle
      .close({
        onForceStop: () => {
          void server.stop(true);
        },
      })
      .pipe(Effect.runPromise);
    // oxlint-disable-next-line effecttsgo/global-fetch -- [EH-106] integration test exercises rejection during shutdown drain.
    return fetch(`${server.url.href}slow`).then((rejectedResponse) =>
      Promise.all([slowRequest, closePromise]).then(([slowResponse]) => {
        expect(slowResponse.status).toBe(successStatus);
        expect(rejectedResponse.status).toBe(httpStatusServiceUnavailable);
        expect(server.pendingRequests).toBe(0);
      }),
    );
  });
};
