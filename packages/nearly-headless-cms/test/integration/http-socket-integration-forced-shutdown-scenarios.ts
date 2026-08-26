import {
  Effect,
  HttpTransport,
  expect,
} from "./http-socket-integration-scenarios-imports.ts";

export const verifyForcedShutdownAfterDrainTimeout = (): Promise<void> => {
  // oxlint-disable-next-line eslint/sort-vars -- [EH-264] forced shutdown locals follow lifecycle, handler, and server order.
  const lifecycle = HttpTransport.createTransportLifecycle({
      drainTimeoutMilliseconds: 50,
    }),
    // oxlint-disable-next-line eslint/sort-vars -- [EH-267] hanging handler follows lifecycle construction.
    hangingHandler = lifecycle.wrapHandler(
      // oxlint-disable-next-line effecttsgo/new-promise -- [EH-251] hanging handler keeps the socket open until forced shutdown.
      () => new Promise<Response>(() => {}),
    ),
    // oxlint-disable-next-line eslint/sort-vars -- [EH-271] live server follows hanging handler construction.
    server = Bun.serve({
      fetch: (request) => hangingHandler(request),
      port: 0,
    });
  // oxlint-disable-next-line effecttsgo/global-fetch -- [EH-248] integration test starts a request that outlives the drain window.
  void fetch(`${server.url.href}hang`).catch(() => {});
  return Effect.runPromise(
    lifecycle.close({
      onForceStop: () => {
        void server.stop(true);
      },
      onStopAccepting: () => {
        void server.stop(false);
      },
    }),
  ).then(() => {
    expect(lifecycle.activeRequestCount()).toBe(0);
    expect(server.pendingRequests).toBe(0);
  });
};
