const runtimeAfterMakeGeneratedClient = `
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-025] generated clients expose a Promise-backed transport boundary; converting this callback to Effect would change the generated public client contract.
  parseOperationSuccessResponse = async (
    input: Readonly<OperationSuccessParseInput>,
  ): Promise<unknown> => {
    if (input.response.status === httpStatusNoContent || input.specification.method === "HEAD") {
      return undefined;
    }
    if (input.successResponse.responseMediaType === "application/octet-stream") {
      return new Uint8Array(await input.response.arrayBuffer());
    }
    if (!input.mediaType.includes("application/json")) {
      throw ProtocolFailure.make({
        message: "Expected application/json response",
        status: input.response.status,
      });
    }
    try {
      return await input.response.json();
    } catch {
      throw ProtocolFailure.make({
        message: "Malformed JSON response",
        status: input.response.status,
      });
    }
  },
  prepareOperationRequest = (
    baseAddress: string,
    input: Readonly<OperationInputs[keyof OperationInputs]>,
    specification: Readonly<OperationSpecification>,
  ): { readonly body: BodyInit | undefined; readonly headers: Headers; readonly requestUrl: URL } => {
    let { path } = specification;
    if ("path" in input && input.path !== undefined) {
      path = substitutePathParameters(path, input.path);
    }
    const requestUrl = transportRequestSupport.buildRequestUrl(baseAddress, path);
    if ("query" in input && input.query !== undefined) {
      transportRequestSupport.appendQueryParameters(requestUrl, input.query);
    }
    return {
      body: transportRequestSupport.buildRequestBody(
        input,
        transportRequestSupport.buildRequestHeaders(input),
        specification,
      ),
      headers: transportRequestSupport.buildRequestHeaders(input),
      requestUrl,
    };
  },
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-025] generated clients expose a Promise-backed transport boundary; converting this callback to Effect would change the generated public client contract.
  resolveOperationFailure = async (response: Readonly<Response>, mediaType: string): Promise<never> => {
    if (mediaType.includes("application/json")) {
      throwDeclaredFailure(response, await response.json());
    }
    throw ProtocolFailure.make({
      message: \`Unexpected response status \${response.status}\`,
      status: response.status,
    });
  },
  substitutePathParameters = (
    pathTemplate: string,
    pathParameters: Readonly<Record<string, unknown>>,
  ): string => {
    let path = pathTemplate;
    for (const [name, value] of Object.entries(pathParameters)) {
      path = path.replace(\`{\${name}}\`, encodeURIComponent(String(value)));
    }
    return path;
  },
  throwDeclaredFailure = (response: Readonly<Response>, failure: unknown): never => {
    if (isDeclaredFailurePayload(failure)) {
      const { code, details, message } = failure;
      throw DeclaredFailure.make({
        code: String(code),
        details,
        message: String(message),
        status: response.status,
      });
    }
    throw ProtocolFailure.make({
      message: \`Unexpected response status \${response.status}\`,
      status: response.status,
    });
  },
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-025] generated clients expose a Promise-backed transport boundary; converting this callback to Effect would change the generated public client contract.
  undertakeOperationRequest = async (request: Readonly<OperationRequestInput>): Promise<unknown> => {
    const { body, headers, requestUrl } = prepareOperationRequest(
      request.baseAddress,
      request.input,
      request.specification,
    ),
     fetchResponse = await fetchOperationResponse({
      body,
      headers,
      method: request.specification.method,
      requestUrl,
      signal: request.signal,
    }),
     responseMediaType = fetchResponse.headers.get("content-type") ?? "",
     successResponse = request.specification.successResponses.find(
      ({ status }) => status === fetchResponse.status,
    );
    if (successResponse === undefined) {
      return resolveOperationFailure(fetchResponse, responseMediaType);
    }
    return parseOperationSuccessResponse({
      mediaType: responseMediaType,
      response: fetchResponse,
      specification: request.specification,
      successResponse,
    });
  }
  `,
  runtimeBeforeSpecifications = `const connectionFailureMessage = (cause: unknown): string => {
    if (cause instanceof Error) {
      return cause.message;
    }
    return "Connection failed";
  },
  createOperationMethod = <Identifier extends keyof OperationInputs>(
    baseAddress: string,
    identifier: Identifier,
  ): ((
    input: OperationInputs[Identifier],
    signal?: Pick<AbortSignal, "aborted" | "addEventListener" | "reason" | "removeEventListener" | "throwIfAborted">,
  ) => Effect.Effect<
    OperationResponses[Identifier],
    TransportFailure | ProtocolFailure | DeclaredFailure
  >) =>
    (input, signal) =>
      requestOperation({
        baseAddress,
        input,
        signal,
        specification: operationSpecifications[identifier],
      }),
  fetchOperationResponse = (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-196] OperationFetchRequest carries optional readonly abort signal bridge fields.
    request: Readonly<OperationFetchRequest>,
  ): Promise<Response> =>
    // oxlint-disable-next-line effecttsgo/global-fetch, effecttsgo/global-fetch-in-effect -- [EH-235, EH-236] generated clients intentionally use the platform fetch boundary so callers can supply the browser or server runtime.
    fetch(request.requestUrl, {
      body: request.body,
      headers: request.headers,
      method: request.method,
      // oxlint-disable-next-line eslint/no-ternary -- [EH-237] generated fetch bridge keeps compact signal fallback.
      signal: request.signal === undefined ? undefined : toAbortSignal(request.signal),
    }).catch((error) => {
      throw TransportFailure.make({ message: connectionFailureMessage(error) });
    }),
  toAbortSignal = (
    signal: Pick<AbortSignal, "aborted" | "addEventListener" | "reason" | "removeEventListener" | "throwIfAborted">,
  ): AbortSignal =>
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- [EH-141] fetch requires AbortSignal; generated clients pass the runtime signal.
    signal as unknown as AbortSignal,
  `,
  runtimeConstChainMiddle = `
  isDeclaredFailurePayload = (
    value: unknown,
  ): value is { readonly code: unknown; readonly details?: unknown; readonly message: unknown } =>
    value !== null && typeof value === "object" && "code" in value && "message" in value,
  isKnownFailure = (
    cause: unknown,
  ): cause is TransportFailure | ProtocolFailure | DeclaredFailure =>
    Schema.is(TransportFailure)(cause) ||
    Schema.is(ProtocolFailure)(cause) ||
    Schema.is(DeclaredFailure)(cause),
  `,
  runtimeRequestOperation = `function requestOperation<Identifier extends keyof OperationInputs>(
  request: Readonly<RequestOperationInput<Identifier>>,
): Effect.Effect<
  OperationResponses[Identifier],
  TransportFailure | ProtocolFailure | DeclaredFailure
>;
function requestOperation({
  baseAddress,
  input,
  signal,
  specification,
}: Readonly<RequestOperationInput<keyof OperationInputs>>): Effect.Effect<
  unknown,
  TransportFailure | ProtocolFailure | DeclaredFailure
> {
  return Effect.tryPromise({
    catch: (cause) => {
      if (isKnownFailure(cause)) {
        return cause;
      }
      return TransportFailure.make({ message: connectionFailureMessage(cause) });
    },
    try: (): Promise<unknown> =>
      undertakeOperationRequest({ baseAddress, input, signal, specification }),
  });
}
`,
  runtimeTransportRequestSupport = `const appendQueryParameters = (
    requestUrl: Pick<URL, "pathname" | "searchParams">,
    queryParameters: Readonly<Record<string, unknown>>,
  ): void => {
    for (const [name, value] of Object.entries(queryParameters)) {
      if (value !== undefined) {
        if (
          typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean" ||
          typeof value === "bigint"
        ) {
          requestUrl.searchParams.set(name, String(value));
        } else {
          requestUrl.searchParams.set(name, JSON.stringify(value));
        }
      }
    }
  },
  buildRequestBody = (
    input: Readonly<OperationInputs[keyof OperationInputs]>,
    headers: Headers,
    specification: Readonly<OperationSpecification>,
  ): BodyInit | undefined => {
    if (!("body" in input) || input.body === undefined) {
      return undefined;
    }
    const { body: requestBody } = input;
    if (requestBody instanceof FormData) {
      return requestBody;
    }
    headers.set("content-type", specification.requestMediaType ?? "application/json");
    // oxlint-disable-next-line effecttsgo/prefer-schema-over-json -- [EH-107] request bodies are OpenAPI-generated unknown shapes and must be serialized using the browser JSON boundary.
    return JSON.stringify(requestBody);
  },
  buildRequestHeaders = (input: Readonly<OperationInputs[keyof OperationInputs]>): Headers => {
    if ("headers" in input) {
      return new Headers(input.headers);
    }
    return new Headers();
  },
  buildRequestUrl = (baseAddress: string, path: string): URL =>
    new URL(
      \`\${baseAddress}\${path}\`,
      baseAddress || globalThis.location?.origin || "http://localhost",
    );

export default { appendQueryParameters, buildRequestBody, buildRequestHeaders, buildRequestUrl };
`,
  runtimeTypes = `export interface RequestOperationInput<Identifier extends keyof OperationInputs> {
  readonly baseAddress: string;
  readonly input: OperationInputs[Identifier];
  readonly signal?: Pick<AbortSignal, "aborted" | "addEventListener" | "reason" | "removeEventListener" | "throwIfAborted">;
  readonly specification: OperationSpecification;
}

export interface OperationFetchRequest {
  readonly body: BodyInit | undefined;
  readonly headers: Headers;
  readonly method: string;
  readonly requestUrl: URL;
  readonly signal: Pick<AbortSignal, "aborted" | "addEventListener" | "reason" | "removeEventListener" | "throwIfAborted"> | undefined;
}

export interface OperationSuccessParseInput {
  readonly mediaType: string;
  readonly response: Response;
  readonly specification: OperationSpecification;
  readonly successResponse: OperationSpecification["successResponses"][number];
}

export interface OperationRequestInput {
  readonly baseAddress: string;
  readonly input: OperationInputs[keyof OperationInputs];
  readonly signal: Pick<AbortSignal, "aborted" | "addEventListener" | "reason" | "removeEventListener" | "throwIfAborted"> | undefined;
  readonly specification: OperationSpecification;
}
`;

/** Static runtime emitted before and after the generated operation specifications. */
export {
  runtimeAfterMakeGeneratedClient,
  runtimeBeforeSpecifications,
  runtimeConstChainMiddle,
  runtimeRequestOperation,
  runtimeTransportRequestSupport,
  runtimeTypes,
};
