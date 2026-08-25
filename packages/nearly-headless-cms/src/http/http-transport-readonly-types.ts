/** Readonly views of Web platform types used at the HTTP transport boundary. */
export type ReadonlyTransportAbortSignal = Pick<
  AbortSignal,
  "aborted" | "addEventListener" | "reason" | "removeEventListener" | "throwIfAborted"
>;

export type ReadonlyTransportRequest = Pick<
  Request,
  "arrayBuffer" | "clone" | "headers" | "json" | "method" | "url"
>;

export type ReadonlyTransportUrl = Pick<URL, "pathname" | "searchParams">;

/** Handler entrypoint request: transport fields plus the client abort signal. */
export type ReadonlyTransportHandlerRequest = ReadonlyTransportRequest & {
  readonly signal: ReadonlyTransportAbortSignal;
};

/** Bridges readonly transport views to Web APIs that require concrete platform types. */
export const toAbortSignal = <SignalType extends ReadonlyTransportAbortSignal>(
    signal: Readonly<SignalType>,
  ): AbortSignal =>
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- [EH-151] Web APIs require AbortSignal; transport callers always pass the real signal.
    signal as unknown as AbortSignal,
  toWebRequest = <RequestType extends ReadonlyTransportRequest>(
    request: Readonly<RequestType>,
  ): Request =>
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- [EH-152] Web APIs require Request; transport callers always pass the real request.
    request as unknown as Request;
