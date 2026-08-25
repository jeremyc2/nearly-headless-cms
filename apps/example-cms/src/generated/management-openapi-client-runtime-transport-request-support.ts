import type { OperationInputs } from "./management-openapi-client-operation-inputs.ts";
import type { OperationSpecification } from "./management-openapi-client-specification-types.ts";

const appendQueryParameters = (
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
      `${baseAddress}${path}`,
      baseAddress || globalThis.location?.origin || "http://localhost",
    );

export default { appendQueryParameters, buildRequestBody, buildRequestHeaders, buildRequestUrl };
