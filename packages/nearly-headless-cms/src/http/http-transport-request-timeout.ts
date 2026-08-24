import { Duration, Effect, Fiber } from "effect";
import transportResponse from "./http-transport-response.ts";
import { RequestFailureError } from "./http-transport-request-failure.ts";
import type { Handler } from "./http-transport-types.ts";

const { requestFailureResponse } = transportResponse,
  requestTimeoutResponse = (requestId: string): Response =>
    requestFailureResponse(
      new RequestFailureError(
        "RequestTimeout",
        "The request was interrupted or exceeded its configured duration",
        408,
      ),
      requestId,
    ),
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
        timeoutFiber = Effect.runFork(
          Effect.sleep(Duration.millis(requestTimeoutMilliseconds)).pipe(
            Effect.andThen(
              Effect.sync(() => {
                controller.abort(new Error("request timeout"));
              }),
            ),
          ),
        );
      request.signal.addEventListener("abort", onClientAbort, { once: true });
      try {
        const scopedRequest = new Request(request, { signal: controller.signal }),
          abortPromise = Effect.runPromise(
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
          requestPromise = handleRequest(scopedRequest, controller.signal, requestId).catch(
            (error: unknown) => {
              if (controller.signal.aborted) {
                return requestTimeoutResponse(requestId);
              }
              throw error;
            },
          );
        // oxlint-disable-next-line effecttsgo/run-effect-inside-effect -- bridge the abort callback into Promise.race.
        return await Promise.race([requestPromise, abortPromise]);
      } finally {
        // oxlint-disable-next-line effecttsgo/run-effect-inside-effect -- interrupt the owned timer fiber during Web handler cleanup.
        await Effect.runPromise(Fiber.interrupt(timeoutFiber));
        request.signal.removeEventListener("abort", onClientAbort);
      }
    };

export default wrapHandlerWithTimeout;
