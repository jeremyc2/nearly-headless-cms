// oxlint-disable-next-line eslint/sort-imports -- [EH-257] Bun transport startup imports follow Effect, failure mapping, and lifecycle dependency order.
import { InfrastructureFailure } from "../../cms-error.ts";
// oxlint-disable-next-line eslint/sort-imports -- [EH-257] Bun transport startup imports follow Effect, failure mapping, and lifecycle dependency order.
import { Effect } from "effect";
// oxlint-disable-next-line eslint/sort-imports -- [EH-257] Bun transport startup imports follow Effect, failure mapping, and lifecycle dependency order.
import createTransportLifecycle, {
  type TransportLifecycleOptions,
} from "../../http/http-transport-lifecycle-support.ts";
import type { Handler } from "../../http/http-transport-types.ts";
import type { RunningTransport } from "../../transport.ts";

interface StartBunHttpTransportInput extends TransportLifecycleOptions {
  readonly handler: Handler;
  readonly port?: number;
}

const startBunHttpTransport = (
  input: Readonly<StartBunHttpTransportInput>,
): Effect.Effect<RunningTransport, InfrastructureFailure> =>
  Effect.gen(function* startBunHttpTransportEffect() {
    const lifecycle = createTransportLifecycle({
      drainTimeoutMilliseconds: input.drainTimeoutMilliseconds,
    });
    // oxlint-disable-next-line eslint/one-var -- [EH-255] transport startup keeps separate statements so lint autofix does not merge dependency-ordered locals.
    const wrappedHandler = lifecycle.wrapHandler(input.handler);
    // oxlint-disable-next-line eslint/one-var -- [EH-255] transport startup keeps separate statements so lint autofix does not merge dependency-ordered locals.
    const server = yield* Effect.try({
      catch: (cause) => {
        let message = "Failed to start the HTTP transport";
        if (cause instanceof Error) {
          ({ message } = cause);
        }
        return InfrastructureFailure.make({ message, retryable: true });
      },
      try: () =>
        Bun.serve({
          fetch: (request) => wrappedHandler(request),
          port: input.port ?? 0,
        }),
    });
    // oxlint-disable-next-line eslint/one-var -- [EH-255] transport startup keeps separate statements so lint autofix does not merge dependency-ordered locals.
    const address = server.url.href;
    // oxlint-disable-next-line eslint/one-var -- [EH-255] transport startup keeps separate statements so lint autofix does not merge dependency-ordered locals.
    const close = lifecycle
      .close({
        onForceStop: () => {
          void server.stop(true);
        },
        onStopAccepting: () => {
          void server.stop(false);
        },
      })
      .pipe(
        Effect.andThen(
          Effect.sync(() => {
            if (server.pendingRequests !== 0) {
              throw InfrastructureFailure.make({
                message: "Expected the HTTP transport to release all pending requests",
                retryable: false,
              });
            }
          }),
        ),
      );
    return { address, close };
  });

export type { StartBunHttpTransportInput };
export default startBunHttpTransport;
