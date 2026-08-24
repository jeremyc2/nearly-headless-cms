const zRuntimeAfterSpecifications = ` satisfies Readonly<Record<keyof OperationInputs, OperationSpecification>>;

interface RequestOperationInput<Identifier extends keyof OperationInputs> {
  readonly baseAddress: string;
  readonly input: OperationInputs[Identifier];
  readonly signal?: AbortSignal;
  readonly specification: OperationSpecification;
}

function requestOperation<Identifier extends keyof OperationInputs>(
  request: RequestOperationInput<Identifier>,
): Effect.Effect<OperationResponses[Identifier], TransportFailure | ProtocolFailure | DeclaredFailure>;
function requestOperation({
  baseAddress,
  input,
  signal,
  specification,
}: RequestOperationInput<keyof OperationInputs>): Effect.Effect<unknown, TransportFailure | ProtocolFailure | DeclaredFailure> {
  return Effect.tryPromise({
      catch: (cause) =>
       Schema.is(TransportFailure)(cause) || Schema.is(ProtocolFailure)(cause) || Schema.is(DeclaredFailure)(cause)
         ? cause
          : TransportFailure.make({ message: cause instanceof Error ? cause.message : "Connection failed" }),
      // oxlint-disable-next-line effecttsgo/async-function -- generated clients expose a Promise-backed transport boundary; converting this callback to Effect would change the generated public client contract.
      try: async () => {
        let { path } = specification;
        if ("path" in input && input.path !== undefined) {
          for (const [name, value] of Object.entries(input.path)) {
            path = path.replace(\`{\${name}}\`, encodeURIComponent(String(value)));
          }
        }
        const requestUrl = new URL(\`\${baseAddress}\${path}\`, baseAddress || globalThis.location?.origin || "http://localhost");
        if ("query" in input && input.query !== undefined) {
          for (const [name, value] of Object.entries(input.query)) {
            if (value !== undefined) {
              requestUrl.searchParams.set(name, String(value));
            }
          }
        }
        const headers = new Headers("headers" in input ? input.headers : undefined);
        let body: BodyInit | undefined;
        if ("body" in input && input.body !== undefined) {
          const { body: requestBody } = input;
          if (requestBody instanceof FormData) {
            body = requestBody;
          } else {
            headers.set("content-type", specification.requestMediaType ?? "application/json");
            // oxlint-disable-next-line effecttsgo/prefer-schema-over-json -- request bodies are OpenAPI-generated unknown shapes and must be serialized using the browser JSON boundary.
            body = JSON.stringify(requestBody);
          }
        }
        let response: Response;
        try {
          // oxlint-disable-next-line effecttsgo/global-fetch-in-effect -- generated clients intentionally use the platform fetch boundary so callers can supply the browser or server runtime.
          response = await fetch(requestUrl, { body, headers, method: specification.method, signal });
        } catch (cause) {
          throw TransportFailure.make({ message: cause instanceof Error ? cause.message : "Connection failed" });
        }
        const mediaType = response.headers.get("content-type") ?? "";
        const successResponse = specification.successResponses.find(({ status }) => status === response.status);
        if (successResponse === undefined) {
          if (mediaType.includes("application/json")) {
            const failure: unknown = await response.json();
            if (failure !== null && typeof failure === "object" && "code" in failure && "message" in failure) {
              throw DeclaredFailure.make({ code: String(failure.code), details: "details" in failure ? failure.details : undefined, message: String(failure.message), status: response.status });
            }
          }
          throw ProtocolFailure.make({ message: \`Unexpected response status \${response.status}\`, status: response.status });
        }
        if (response.status === 204 || specification.method === "HEAD") {
          return;
        }
        if (successResponse.responseMediaType === "application/octet-stream") {
          return new Uint8Array(await response.arrayBuffer());
        }
        if (!mediaType.includes("application/json")) {
          throw ProtocolFailure.make({ message: "Expected application/json response", status: response.status });
        }
        try {
          return await response.json();
        } catch {
          throw ProtocolFailure.make({ message: "Malformed JSON response", status: response.status });
        }
      },
    });
}

export const makeGeneratedClient = (baseAddress = "") => ({
`;

/** Static runtime emitted after the generated operation specifications. */
export { zRuntimeAfterSpecifications as runtimeAfterSpecifications };
