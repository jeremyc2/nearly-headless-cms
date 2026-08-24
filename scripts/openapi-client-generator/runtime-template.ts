const runtimeAfterMakeGeneratedClient = `,
  // oxlint-disable-next-line effecttsgo/async-function -- generated clients expose a Promise-backed transport boundary; converting this callback to Effect would change the generated public client contract.
  parseOperationSuccessResponse = async (
    input: OperationSuccessParseInput,
  ): Promise<unknown> => {
    if (input.response.status === 204 || input.specification.method === "HEAD") {
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
    input: OperationInputs[keyof OperationInputs],
    specification: OperationSpecification,
  ): { readonly body: BodyInit | undefined; readonly headers: Headers; readonly requestUrl: URL } => {
    let path = specification.path;
    if ("path" in input && input.path !== undefined) {
      path = substitutePathParameters(path, input.path);
    }
    const requestUrl = buildRequestUrl(baseAddress, path);
    if ("query" in input && input.query !== undefined) {
      appendQueryParameters(requestUrl, input.query);
    }
    return {
      body: buildRequestBody(input, buildRequestHeaders(input), specification),
      headers: buildRequestHeaders(input),
      requestUrl,
    };
  },
  // oxlint-disable-next-line effecttsgo/async-function -- generated clients expose a Promise-backed transport boundary; converting this callback to Effect would change the generated public client contract.
  resolveOperationFailure = async (response: Response, mediaType: string): Promise<never> => {
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
  throwDeclaredFailure = (response: Response, failure: unknown): never => {
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
  // oxlint-disable-next-line effecttsgo/async-function -- generated clients expose a Promise-backed transport boundary; converting this callback to Effect would change the generated public client contract.
  undertakeOperationRequest = async (request: OperationRequestInput): Promise<unknown> => {
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
  runtimeBeforeSpecifications = `interface RequestOperationInput<Identifier extends keyof OperationInputs> {
  readonly baseAddress: string;
  readonly input: OperationInputs[Identifier];
  readonly signal?: AbortSignal;
  readonly specification: OperationSpecification;
}

interface OperationFetchRequest {
  readonly body: BodyInit | undefined;
  readonly headers: Headers;
  readonly method: string;
  readonly requestUrl: URL;
  readonly signal: AbortSignal | undefined;
}

interface OperationSuccessParseInput {
  readonly mediaType: string;
  readonly response: Response;
  readonly specification: OperationSpecification;
  readonly successResponse: OperationSpecification["successResponses"][number];
}

interface OperationRequestInput {
  readonly baseAddress: string;
  readonly input: OperationInputs[keyof OperationInputs];
  readonly signal: AbortSignal | undefined;
  readonly specification: OperationSpecification;
}

const appendQueryParameters = (
    requestUrl: URL,
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
    input: OperationInputs[keyof OperationInputs],
    headers: Headers,
    specification: OperationSpecification,
  ): BodyInit | undefined => {
    if (!("body" in input) || input.body === undefined) {
      return undefined;
    }
    const { body: requestBody } = input;
    if (requestBody instanceof FormData) {
      return requestBody;
    }
    headers.set("content-type", specification.requestMediaType ?? "application/json");
    // oxlint-disable-next-line effecttsgo/prefer-schema-over-json -- request bodies are OpenAPI-generated unknown shapes and must be serialized using the browser JSON boundary.
    return JSON.stringify(requestBody);
  },
  buildRequestHeaders = (input: OperationInputs[keyof OperationInputs]): Headers => {
    if ("headers" in input) {
      return new Headers(input.headers);
    }
    return new Headers();
  },
  buildRequestUrl = (baseAddress: string, path: string): URL =>
    new URL(
      \`\${baseAddress}\${path}\`,
      baseAddress || globalThis.location?.origin || "http://localhost",
    ),
  connectionFailureMessage = (cause: unknown): string => {
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
    signal?: AbortSignal,
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
  /* oxlint-disable effecttsgo/global-fetch, effecttsgo/global-fetch-in-effect -- generated clients intentionally use the platform fetch boundary so callers can supply the browser or server runtime. */
  fetchOperationResponse = (request: OperationFetchRequest): Promise<Response> =>
    fetch(request.requestUrl, {
      body: request.body,
      headers: request.headers,
      method: request.method,
      signal: request.signal,
    }).catch((error) => {
      throw TransportFailure.make({ message: connectionFailureMessage(error) });
    }),
  /* oxlint-enable effecttsgo/global-fetch, effecttsgo/global-fetch-in-effect */
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
  request: RequestOperationInput<Identifier>,
): Effect.Effect<
  OperationResponses[Identifier],
  TransportFailure | ProtocolFailure | DeclaredFailure
>;
function requestOperation({
  baseAddress,
  input,
  signal,
  specification,
}: RequestOperationInput<keyof OperationInputs>): Effect.Effect<
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
`;

/** Static runtime emitted before and after the generated operation specifications. */
export {
  runtimeAfterMakeGeneratedClient,
  runtimeBeforeSpecifications,
  runtimeConstChainMiddle,
  runtimeRequestOperation,
};
