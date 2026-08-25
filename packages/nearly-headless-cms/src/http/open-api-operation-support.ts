import type {
  OperationSchema,
  OperationSchemas,
} from "./http-contract.ts";
import type { OperationDescriptor } from "./open-api-types.ts";
import { Schema } from "effect";
import buildCompletedOperation from "./open-api-operation-completion-support.ts";
import openApiOperationDescriptorSupport from "./open-api-operation-descriptor-support.ts";
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
  bEffectSchema = <SchemaType extends OperationSchema>(
    schema: Readonly<SchemaType>,
  ): Readonly<Record<string, unknown>> => {
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
  dPathParameterSchema = <SchemaType extends OperationSchema>(
    parameterName: string,
    declaredSchema: Readonly<SchemaType> | undefined,
  ): Readonly<Record<string, unknown>> => {
    if (declaredSchema !== undefined) {
      return bEffectSchema(declaredSchema);
    }
    if (parameterName === "revisionNumber") {
      return { type: "integer" };
    }
    return { type: "string" };
  },
  ePathParameters = <Schemas extends OperationSchemas>(
    path: string,
    operationSchemas?: Readonly<Schemas>,
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
  fQueryParameters = <Schemas extends OperationSchemas>(
    operationIdentifier: string,
    operationSchemas?: Readonly<Schemas>,
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
  gHeaderParameters = <Schemas extends OperationSchemas>(
    operationIdentifier: string,
    operationSchemas?: Readonly<Schemas>,
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
  hRequestBodySchema = <SchemaType extends OperationSchema>(
    operationIdentifier: string,
    declaredRequestBody: Readonly<SchemaType> | undefined,
  ): Readonly<Record<string, unknown>> | undefined => {
    if (declaredRequestBody !== undefined) {
      return bEffectSchema(declaredRequestBody);
    }
    return requestBodySchemas.get(operationIdentifier);
  },
  iResponseSchema = <Descriptor extends OperationDescriptor>(
    operationDescriptor: Readonly<Descriptor>,
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
  isOperationDescriptorMap = (
    value: unknown,
  ): value is Readonly<Record<string, OperationDescriptor>> =>
    value !== null && typeof value === "object" && !Array.isArray(value),
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
  }: Readonly<OperationResponsesInput>): Readonly<Record<string, unknown>> => ({
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
  nCompleteOperation = <Descriptor extends OperationDescriptor>(
    path: string,
    method: string,
    operationDescriptor: Readonly<Descriptor>,
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
      responseSchema = iResponseSchema(operationDescriptor, responseMediaType);
    return buildCompletedOperation({
      bodyless,
      conditionalValue: aConditionalValue,
      firstIndex,
      operationIdentifier,
      operationResponses: kOperationResponses,
      parameters,
      requestBodySchema,
      requestMediaType,
      responseMediaType,
      responseSchema,
      successStatus:
        operationDescriptor.successStatus ?? successStatuses.get(operationIdentifier) ?? okStatus,
    });
  },
  pCompletePaths = <
    Paths extends Readonly<Record<string, Readonly<Record<string, OperationDescriptor>>>>,
  >(
    paths: Readonly<Paths>,
  ): Readonly<Record<string, Readonly<Record<string, unknown>>>> =>
    Object.fromEntries(
      Object.entries(paths).map(([path, methods]) => {
        let operationDescriptors: Readonly<Record<string, OperationDescriptor>> = {};
        if (isOperationDescriptorMap(methods)) {
          operationDescriptors = methods;
        }
        return [
          path,
          Object.fromEntries(
            Object.entries(operationDescriptors).map(([method, operationDescriptor]) => [
              method,
              nCompleteOperation(path, method, operationDescriptor),
            ]),
          ),
        ];
      }),
    ),
  qCustomDescriptor = openApiOperationDescriptorSupport.customDescriptor,
  rDescriptor = openApiOperationDescriptorSupport.descriptor;

export default {
  completePaths: pCompletePaths,
  customDescriptor: qCustomDescriptor,
  descriptor: rDescriptor,
};
