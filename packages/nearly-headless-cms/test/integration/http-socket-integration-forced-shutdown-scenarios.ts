import {
  Effect,
  HttpTransport,
  expect,
} from "./http-socket-integration-scenarios-imports.ts";

export const verifyForcedShutdownAfterDrainTimeout = (): Promise<void> => {
  const lifecycle = HttpTransport.createTransportLifecycle({
      drainTimeoutMilliseconds: 50,
    }),
    hangingHandler = lifecycle.wrapHandler(
      // oxlint-disable-next-line effecttsgo/new-promise -- [EH-141] hanging handler keeps the socket open until forced shutdown.
      () => new Promise<Response>(() => {}),
    ),
    server = Bun.serve({
      fetch: (request) => hangingHandler(request),
      port: 0,
    });
  // oxlint-disable-next-line effecttsgo/global-fetch -- [EH-109] integration test starts a request that outlives the drain window.
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
