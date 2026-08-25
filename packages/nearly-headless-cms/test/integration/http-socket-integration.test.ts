import {
  DevelopmentCms,
  Effect,
  HttpTransport,
  describe,
  expect,
  snapshot,
  successStatus,
  test,
} from "./http-socket-integration-scenarios-imports.ts";

// oxlint-disable-next-line eslint/sort-vars -- [EH-133] discovery handler effect is declared before the socket scenario uses it.
const discoveryHandlerEffect = HttpTransport.makeHandler({}).pipe(
  // oxlint-disable-next-line effecttsgo/strict-effect-provide -- [EH-112] test entry point needs a fresh isolated layer.
  Effect.provide(DevelopmentCms.layer({ snapshot })),
);

describe("HTTP real-socket integration", () => {
  test("serves discovery over a live socket and releases the listener on shutdown", () =>
    Effect.runPromise(discoveryHandlerEffect).then((handler) => {
      // oxlint-disable-next-line eslint/sort-vars -- [EH-133] discovery URL is derived from the live server under test.
      const server = Bun.serve({
        fetch: (request) => handler(request),
        port: 0,
      }),
        // oxlint-disable-next-line eslint/sort-vars -- [EH-133] discovery URL is derived from the live server under test.
        discoveryUrl = `${server.url.href}api/v1/headless/discovery`;
      return (
        // oxlint-disable-next-line effecttsgo/global-fetch -- [EH-080] integration test exercises the live HTTP listener through the platform fetch boundary.
        fetch(discoveryUrl)
      )
        .then((response) => {
          expect(response.status).toBe(successStatus);
          return server.stop(true);
        })
        .then(() => {
          expect(server.pendingRequests).toBe(0);
        });
    }));
});
