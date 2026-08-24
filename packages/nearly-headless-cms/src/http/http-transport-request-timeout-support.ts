import { Duration, Effect, Fiber } from "effect";
import type { Handler } from "./http-transport-types.ts";
import { RequestFailureError } from "./http-transport-request-failure.ts";
import transportResponse from "./http-transport-response.ts";

interface RunTimedRequestInput {
  readonly controller: AbortController;
  readonly handleRequest: (request: Request, signal: AbortSignal, requestId: string) => Promise<Response>;
  readonly request: Request;
  readonly requestId: string;
}

const { requestFailureResponse } = transportResponse,
  abortRequestOnTimeout = (controller: AbortController): void => {
    controller.abort(new Error("request timeout"));
  },
  buildTimeoutEffect = (controller: AbortController, requestTimeoutMilliseconds: number) => {
    const abortEffect = Effect.sync(() => {
      abortRequestOnTimeout(controller);
    });
    return Effect.sleep(Duration.millis(requestTimeoutMilliseconds)).pipe(Effect.andThen(abortEffect));
  },
  createAbortPromise = (controller: AbortController, requestId: string): Promise<Response> =>
    Effect.runPromise(
      Effect.callback<Response>((resume) => {
        controller.signal.addEventListener(
          "abort",
          () => {
            resume(Effect.succeed(requestTimeoutResponse(requestId)));
          },
          { once: true },
        );
      }),
    ),
  createTimeoutFiber = (controller: AbortController, requestTimeoutMilliseconds: number) =>
    Effect.runFork(buildTimeoutEffect(controller, requestTimeoutMilliseconds)),
  requestTimeoutResponse = (requestId: string): Response =>
    requestFailureResponse(
      new RequestFailureError(
        "RequestTimeout",
        "The request was interrupted or exceeded its configured duration",
        408,
      ),
      requestId,
    ),
  runTimedRequest = ({
    controller,
    handleRequest,
    request,
    requestId,
  }: RunTimedRequestInput): Promise<Response> => {
    const abortPromise = createAbortPromise(controller, requestId),
      requestPromise = handleRequest(
        new Request(request, { signal: controller.signal }),
        controller.signal,
        requestId,
      ).catch((error: unknown) => {
        if (controller.signal.aborted) {
          return requestTimeoutResponse(requestId);
        }
        throw error;
      });
    // oxlint-disable-next-line effecttsgo/run-effect-inside-effect -- bridge the abort callback into Promise.race.
    return Promise.race([requestPromise, abortPromise]);
  },
  // oxlint-disable-next-line effecttsgo/missing-pipeable-signature -- Web handler timeout wrapper is not a pipeable Effect API.
  wrapHandlerWithTimeout = (
    handleRequest: (request: Request, signal: AbortSignal, requestId: string) => Promise<Response>,
    requestIdentifier: () => string,
    requestTimeoutMilliseconds: number,
  ): Handler =>
    // oxlint-disable-next-line effecttsgo/async-function -- Handler is a Web-standard Promise<Response> callback.
    async (request): Promise<Response> => {
      const controller = new AbortController(),
        onClientAbort = (): void => {
          controller.abort(request.signal.reason);
        },
        requestId = requestIdentifier(),
        // oxlint-disable-next-line effecttsgo/run-effect-inside-effect -- this Web handler owns a timer fiber outside the request Effect.
        timeoutFiber = createTimeoutFiber(controller, requestTimeoutMilliseconds);
      request.signal.addEventListener("abort", onClientAbort, { once: true });
      try {
        return await runTimedRequest({ controller, handleRequest, request, requestId });
      } finally {
        // oxlint-disable-next-line effecttsgo/run-effect-inside-effect -- interrupt the owned timer fiber during Web handler cleanup.
        await Effect.runPromise(Fiber.interrupt(timeoutFiber));
        request.signal.removeEventListener("abort", onClientAbort);
      }
    };

export default wrapHandlerWithTimeout;
