import {
  DevelopmentCms,
  Effect,
  HttpTransport,
  expect,
  snapshot,
  startBunHttpTransport,
  successStatus,
} from "./http-socket-integration-scenarios-imports.ts";

const discoveryHandlerEffect = HttpTransport.makeHandler({}).pipe(
    // oxlint-disable-next-line effecttsgo/strict-effect-provide -- [EH-112] test entry point needs a fresh isolated layer.
    Effect.provide(DevelopmentCms.layer({ snapshot })),
  ),
  startDiscoveryTransport = (): Promise<{
    readonly address: string;
    readonly close: Effect.Effect<void>;
  }> =>
    Effect.runPromise(
      discoveryHandlerEffect.pipe(
        Effect.flatMap((handler) =>
          startBunHttpTransport({
            handler,
          }),
        ),
      ),
    ),
  verifyDiscoveryShutdown = (): Promise<void> =>
    startDiscoveryTransport().then((transport) => {
      const discoveryUrl = `${transport.address}api/v1/headless/schema`;
      return (
        // oxlint-disable-next-line effecttsgo/global-fetch -- [EH-247] integration test exercises the live HTTP listener through the platform fetch boundary.
        fetch(discoveryUrl)
      )
        .then((response) => {
          expect(response.status).toBe(successStatus);
          return Effect.runPromise(transport.close);
        })
        .then(() => {});
    });

export { verifyDiscoveryShutdown };
