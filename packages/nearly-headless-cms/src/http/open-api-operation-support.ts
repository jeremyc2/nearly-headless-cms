import type {
  DeliveryOperation,
  ManagementOperation,
  OperationSchema,
  OperationSchemas,
} from "./http-contract.ts";
import type { OperationDescriptor } from "./open-api-types.ts";
import { Schema } from "effect";
import openApiSchemas from "./open-api-schemas.ts";

interface OperationResponsesInput {
  readonly bodyless: boolean;
  readonly operationIdentifier: string;
  readonly responseMediaType: string;
  readonly responseSchema: Readonly<Record<string, unknown>>;
  readonly successStatus: number;
}

const {
    additionalBodylessSuccessStatuses,
    firstIndex,
    noContentStatus,
    okStatus,
    paginatedOperations,
    requestBodySchemas,
    successSchemas,
    successStatuses,
    writeTokenHeaderOperations,
  } = openApiSchemas,
  aConditionalValue = <Value>(condition: boolean, whenTrue: Value, whenFalse: Value): Value => {
    if (condition) {
      return whenTrue;
    }
    return whenFalse;
  },
  bEffectSchema = (schema: OperationSchema): Readonly<Record<string, unknown>> => {
    const document = Schema.toJsonSchemaDocument(schema);
    if (Object.keys(document.definitions).length === firstIndex) {
      return document.schema;
    }
    return { ...document.schema, $defs: document.definitions };
  },
  cErrorResponses = (): Readonly<Record<string, unknown>> => {
    const errorStatusDescriptions: readonly (readonly [string, string])[] = [
      ["400", "Invalid input"],
      ["403", "Forbidden"],
      ["404", "Not found"],
      ["405", "Method not allowed"],
      ["406", "Not acceptable"],
      ["408", "Request timeout"],
      ["409", "Conflict"],
      ["412", "Definition Snapshot changed"],
      ["413", "Payload too large"],
      ["414", "URI too long"],
      ["415", "Unsupported request media type"],
      ["422", "Unsupported query capability"],
      ["431", "Request headers too large"],
      ["500", "Internal error"],
      ["503", "Retryable infrastructure failure"],
    ];
    return errorStatusDescriptions.reduce<Record<string, unknown>>(
      (responses, [status, description]) => {
        responses[status] = {
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/Error" } },
          },
          description,
        };
        return responses;
      },
      {},
    );
  },
  dPathParameterSchema = (
    parameterName: string,
    declaredSchema: OperationSchema | undefined,
  ): Readonly<Record<string, unknown>> => {
    if (declaredSchema !== undefined) {
      return bEffectSchema(declaredSchema);
    }
    if (parameterName === "revisionNumber") {
      return { type: "integer" };
    }
    return { type: "string" };
  },
  ePathParameters = (
    path: string,
    operationSchemas?: OperationSchemas,
  ): readonly Readonly<Record<string, unknown>>[] =>
    [...path.matchAll(/\{(?<parameterName>[^}]+)\}/gu)].map((match) => {
      const parameterName = match.groups?.["parameterName"] ?? "";
      return {
        in: "path",
        name: parameterName,
        required: true,
        schema: dPathParameterSchema(
          parameterName,
          operationSchemas?.pathParameters?.[parameterName],
        ),
      };
    }),
  fQueryParameters = (
    operationIdentifier: string,
    operationSchemas?: OperationSchemas,
  ): readonly Readonly<Record<string, unknown>>[] => {
    let declared = operationSchemas?.queryParameters;
    if (declared === undefined && paginatedOperations.has(operationIdentifier)) {
      declared = { cursor: Schema.String, pageSize: Schema.Int };
    }
    declared ??= {};
    return Object.entries(declared).map(([name, schema]) => ({
      in: "query",
      name,
      required: false,
      schema: bEffectSchema(schema),
    }));
  },
  gHeaderParameters = (
    operationIdentifier: string,
    operationSchemas?: OperationSchemas,
  ): readonly Readonly<Record<string, unknown>>[] => {
    const declared = {
      "CMS-Expected-Definition-Fingerprint": Schema.String,
      "X-Request-Id": Schema.String,
      ...operationSchemas?.requestHeaders,
    };
    if (writeTokenHeaderOperations.has(operationIdentifier)) {
      Object.assign(declared, { "CMS-Write-Token": Schema.String });
    }
    return Object.entries(declared).map(([name, schema]) => ({
      in: "header",
      name,
      required: name !== "CMS-Expected-Definition-Fingerprint" && name !== "X-Request-Id",
      schema: bEffectSchema(schema),
    }));
  },
  hRequestBodySchema = (
    operationIdentifier: string,
    declaredRequestBody: OperationSchema | undefined,
  ): Readonly<Record<string, unknown>> | undefined => {
    if (declaredRequestBody !== undefined) {
      return bEffectSchema(declaredRequestBody);
    }
    return requestBodySchemas.get(operationIdentifier);
  },
  iResponseSchema = (
    operationDescriptor: OperationDescriptor,
    responseMediaType: string,
  ): Readonly<Record<string, unknown>> => {
    if (operationDescriptor.schemas === undefined) {
      return (
        successSchemas.get(operationDescriptor.operationIdentifier) ?? {
          $ref: "#/components/schemas/JsonObject",
        }
      );
    }
    if (responseMediaType === "application/octet-stream") {
      return { format: "binary", type: "string" };
    }
    return bEffectSchema(operationDescriptor.schemas.response);
  },
  jResponseDescription = (bodyless: boolean): string =>
    aConditionalValue(
      bodyless,
      "Operation completed without a response body",
      "Successful response",
    ),
  kOperationResponses = ({
    bodyless,
    operationIdentifier,
    responseMediaType,
    responseSchema,
    successStatus,
  }: OperationResponsesInput): Readonly<Record<string, unknown>> => ({
    [String(successStatus)]: {
      description: jResponseDescription(bodyless),
      ...aConditionalValue(
        bodyless,
        {},
        { content: { [responseMediaType]: { schema: responseSchema } } },
      ),
    },
    ...Object.fromEntries(
      (additionalBodylessSuccessStatuses.get(operationIdentifier) ?? []).map((status) => [
        String(status),
        { description: "Operation completed without a response body" },
      ]),
    ),
    ...cErrorResponses(),
  }),
  lRequestMediaType = (
    operationIdentifier: string,
    declaredRequestMediaType: string | undefined,
  ): string =>
    declaredRequestMediaType ??
    aConditionalValue(
      operationIdentifier === "ingestAsset",
      "multipart/form-data",
      "application/json",
    ),
  mResponseMediaType = (
    operationIdentifier: string,
    declaredResponseMediaType: string | undefined,
  ): string =>
    declaredResponseMediaType ??
    aConditionalValue(
      operationIdentifier === "readAsset" || operationIdentifier === "inspectAssetContent",
      "application/octet-stream",
      "application/json",
    ),
  nCompleteOperation = (
    path: string,
    method: string,
    operationDescriptor: OperationDescriptor,
  ): Readonly<Record<string, unknown>> => {
    const { operationIdentifier } = operationDescriptor,
      bodyless =
        method === "head" ||
        (operationDescriptor.successStatus ??
          successStatuses.get(operationIdentifier) ??
          okStatus) === noContentStatus,
      parameters = [
        ...ePathParameters(path, operationDescriptor.schemas),
        ...fQueryParameters(operationIdentifier, operationDescriptor.schemas),
        ...gHeaderParameters(operationIdentifier, operationDescriptor.schemas),
      ],
      requestBodySchema = hRequestBodySchema(
        operationIdentifier,
        operationDescriptor.schemas?.requestBody,
      ),
      requestMediaType = lRequestMediaType(
        operationIdentifier,
        operationDescriptor.schemas?.requestMediaType,
      ),
      responseMediaType = mResponseMediaType(
        operationIdentifier,
        operationDescriptor.schemas?.responseMediaType,
      ),
      responseSchema = iResponseSchema(operationDescriptor, responseMediaType),
      successStatus =
        operationDescriptor.successStatus ?? successStatuses.get(operationIdentifier) ?? okStatus,
     operation: Record<string, unknown> = {
      operationId: operationIdentifier,
      ...aConditionalValue(parameters.length === firstIndex, {}, { parameters }),
      responses: kOperationResponses({
        bodyless,
        operationIdentifier,
        responseMediaType,
        responseSchema,
        successStatus,
      }),
    };
    if (requestBodySchema !== undefined) {
      operation["requestBody"] = {
        content: { [requestMediaType]: { schema: requestBodySchema } },
        required: true,
      };
    }
    return operation;
  },
  pCompletePaths = (
    paths: Readonly<Record<string, Readonly<Record<string, OperationDescriptor>>>>,
  ): Readonly<Record<string, Readonly<Record<string, unknown>>>> =>
    Object.fromEntries(
      Object.entries(paths).map(([path, methods]) => [
        path,
        Object.fromEntries(
          Object.entries(methods).map(([method, operationDescriptor]) => [
            method,
            nCompleteOperation(path, method, operationDescriptor),
          ]),
        ),
      ]),
    ),
  qCustomDescriptor = (
    operation: DeliveryOperation | ManagementOperation,
  ): OperationDescriptor => {
    const operationDescriptor: OperationDescriptor = {
      operationIdentifier: operation.identifier,
      schemas: operation.schemas,
    };
    if ("successStatus" in operation && operation.successStatus !== undefined) {
      return { ...operationDescriptor, successStatus: operation.successStatus };
    }
    return operationDescriptor;
  },
  rDescriptor = (operationIdentifier: string): OperationDescriptor => ({ operationIdentifier });

export default {
  completePaths: pCompletePaths,
  customDescriptor: qCustomDescriptor,
  descriptor: rDescriptor,
};
