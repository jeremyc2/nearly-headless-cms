// oxlint-disable-next-line eslint/sort-imports -- [EH-256] Bun transport layer imports follow handler, Effect, and transport dependency order.
import { makeHandler } from "../../http/http-transport-handler.ts";
// oxlint-disable-next-line eslint/sort-imports -- [EH-256] Bun transport layer imports follow handler, Effect, and transport dependency order.
import { Effect, Layer } from "effect";
// oxlint-disable-next-line eslint/sort-imports -- [EH-256] Bun transport layer imports follow handler, Effect, and transport dependency order.
import { Service as TransportService } from "../../transport.ts";
// oxlint-disable-next-line eslint/sort-imports -- [EH-256] Bun transport layer imports follow handler, Effect, and transport dependency order.
import type { Service as CmsService } from "../../cms.ts";
import type { Options } from "../../http/http-transport-types.ts";
import startBunHttpTransport from "./bun-http-transport-support.ts";

interface BunHttpTransportLayerOptions {
  readonly drainTimeoutMilliseconds?: number;
  readonly port?: number;
  readonly transportOptions?: Options;
}

const layer = (
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-278] Layer factory accepts optional builder configuration without mutation.
  options: BunHttpTransportLayerOptions = {},
): Layer.Layer<TransportService, never, CmsService> =>
  Layer.effect(TransportService, Effect.gen(function* startBunHttpTransportLayerEffect() {
    const handler = yield* makeHandler(options.transportOptions ?? {});
    return {
      start: startBunHttpTransport({
        drainTimeoutMilliseconds: options.drainTimeoutMilliseconds,
        handler,
        port: options.port,
      }),
    };
  }));

export type { BunHttpTransportLayerOptions };
export { layer };
export default layer;
