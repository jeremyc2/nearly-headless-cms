import { Clock, Duration, Effect } from "effect";
import { toAbortSignal, toWebRequest } from "./http-transport-readonly-types.ts";
import type { Handler } from "./http-transport-types.ts";
import { httpStatusServiceUnavailable } from "./http-status-codes.ts";

interface TransportLifecycleCloseHooks {
  readonly onForceStop?: () => void;
  readonly onStopAccepting?: () => void;
}

interface TransportLifecycleOptions {
  readonly drainTimeoutMilliseconds?: number;
}

interface TransportLifecycle {
  readonly activeRequestCount: () => number;
  readonly close: (
    hooks?: TransportLifecycleCloseHooks,
  ) => Effect.Effect<void>;
  readonly registerFinalizer: (finalizer: () => Promise<void>) => void;
  readonly wrapHandler: (handler: Handler) => Handler;
}

interface LifecycleState {
  accepting: boolean;
  activeRequestCount: number;
  forcedShutdownController: AbortController | undefined;
}

const defaultDrainTimeoutMilliseconds = 5000,
  drainPollIntervalMilliseconds = 10,
  serviceUnavailableBody = JSON.stringify({
    code: "ServiceUnavailable",
    message: "The transport is shutting down and is not accepting new requests",
  }),
  serviceUnavailableResponse = (): Response =>
    new Response(serviceUnavailableBody, {
      headers: { "content-type": "application/json; charset=utf-8" },
      status: httpStatusServiceUnavailable,
    }),
  runRegisteredFinalizers = (
    finalizers: ReadonlySet<() => Promise<void>>,
  ): Effect.Effect<void> =>
    Effect.gen(function* runRegisteredFinalizersEffect() {
      for (const finalizer of finalizers) {
        yield* Effect.promise(() => finalizer().catch(() => {}));
      }
    }),
  waitForActiveRequestDrain = (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-232] drain polling reads shared active-request counters without mutating them.
    lifecycleState: Readonly<LifecycleState>,
    drainTimeoutMilliseconds: number,
  ): Effect.Effect<void> =>
    Effect.gen(function* waitForActiveRequestDrainEffect() {
      const startedAt = yield* Clock.currentTimeMillis;
      while (lifecycleState.activeRequestCount > 0) {
        const elapsed = (yield* Clock.currentTimeMillis) - startedAt;
        if (elapsed >= drainTimeoutMilliseconds) {
          return;
        }
        yield* Effect.sleep(Duration.millis(drainPollIntervalMilliseconds));
      }
    }),
  forceShutdownRemainingRequests = (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-270] shutdown mutates shared lifecycle counters and abort controllers.
    lifecycleState: LifecycleState,
  ): Effect.Effect<void> => {
    const pauseAfterAbort = Effect.sleep(Duration.millis(drainPollIntervalMilliseconds));
    return Effect.sync(() => {
      if (lifecycleState.activeRequestCount === 0) {
        return;
      }
      // oxlint-disable-next-line effecttsgo/abort-controller-in-effect -- [EH-002] transport shutdown keeps one shared AbortController for in-flight Web requests.
      lifecycleState.forcedShutdownController = new AbortController();
      lifecycleState.forcedShutdownController.abort(new Error("transport shutdown drain expired"));
    }).pipe(Effect.andThen(pauseAfterAbort));
  },
  invokeCloseHooks = (
    hooks: Readonly<TransportLifecycleCloseHooks>,
    hookName: keyof TransportLifecycleCloseHooks,
  ): void => {
    const hook = hooks[hookName];
    if (hook !== undefined) {
      hook();
    }
  },
  createWrappedHandler = (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-241] HttpTransport handler mirrors the Web Request callback contract.
    handler: Handler,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-276] wrapped handlers mutate shared active-request counters.
    lifecycleState: LifecycleState,
  ): Handler =>
    // oxlint-disable-next-line effecttsgo/async-function -- [EH-045] lifecycle wrapper is a Web-standard Promise<Response> callback.
    async (request): Promise<Response> => {
      if (!lifecycleState.accepting) {
        return serviceUnavailableResponse();
      }
      lifecycleState.activeRequestCount += 1;
      let wrappedRequest = request;
      const { forcedShutdownController } = lifecycleState;
      if (forcedShutdownController !== undefined) {
        wrappedRequest = new Request(toWebRequest(request), {
          signal: AbortSignal.any([
            toAbortSignal(request.signal),
            forcedShutdownController.signal,
          ]),
        });
      }
      try {
        return await handler(wrappedRequest);
      } finally {
        lifecycleState.activeRequestCount -= 1;
      }
    },
  createTransportLifecycle = (
    options: Readonly<TransportLifecycleOptions> = {},
  ): TransportLifecycle => {
    const drainTimeoutMilliseconds =
        options.drainTimeoutMilliseconds ?? defaultDrainTimeoutMilliseconds,
      finalizers = new Set<() => Promise<void>>(),
      lifecycleState: LifecycleState = {
        accepting: true,
        activeRequestCount: 0,
        forcedShutdownController: undefined,
      };
    return {
      activeRequestCount: () => lifecycleState.activeRequestCount,
      close: (hooks: Readonly<TransportLifecycleCloseHooks> = {}) =>
        Effect.gen(function* closeTransportLifecycleEffect() {
          lifecycleState.accepting = false;
          invokeCloseHooks(hooks, "onStopAccepting");
          yield* waitForActiveRequestDrain(lifecycleState, drainTimeoutMilliseconds);
          yield* forceShutdownRemainingRequests(lifecycleState);
          invokeCloseHooks(hooks, "onForceStop");
          yield* runRegisteredFinalizers(finalizers);
        }),
      registerFinalizer: (finalizer: () => Promise<void>) => {
        finalizers.add(finalizer);
      },
      wrapHandler: (handler: Handler) => createWrappedHandler(handler, lifecycleState),
    };
  };

export type { TransportLifecycle, TransportLifecycleCloseHooks, TransportLifecycleOptions };
export default createTransportLifecycle;
