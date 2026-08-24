export const generatorFormatVersion = 1;

interface Parameter {
  readonly location: "header" | "path" | "query";
  readonly name: string;
  readonly required: boolean;
  readonly schema: Readonly<Record<string, unknown>>;
}

interface GeneratedOperation {
  readonly identifier: string;
  readonly method: string;
  readonly path: string;
  readonly parameters: readonly Parameter[];
  readonly requestBodyRequired: boolean;
  readonly requestBodySchema?: Readonly<Record<string, unknown>>;
  readonly requestMediaType?: string;
  readonly responseMediaType?: string;
  readonly responseSchema?: Readonly<Record<string, unknown>>;
  readonly successStatus: number;
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    value !== null && typeof value === "object" && !Array.isArray(value),
  requireRecord = (value: unknown, description: string): Readonly<Record<string, unknown>> => {
    if (!isRecord(value)) {
      throw new Error(`OpenAPI generator expected ${description}`);
    }
    return value;
  },
  requireString = (value: unknown, description: string): string => {
    if (typeof value !== "string") {
      throw new Error(`OpenAPI generator expected ${description}`);
    }
    return value;
  },
  typeProperty = (name: string): string =>
    /^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(name) ? name : JSON.stringify(name),
  schemaType = (
    schema: Readonly<Record<string, unknown>>,
    localDefinitions: Readonly<Record<string, unknown>> = {},
    visitedReferences: ReadonlySet<string> = new Set(),
  ): string => {
    const reference = schema["$ref"];
    if (typeof reference === "string") {
      if (reference.startsWith("#/components/schemas/")) {
        return reference.slice("#/components/schemas/".length);
      }
      if (reference.startsWith("#/$defs/")) {
        if (visitedReferences.has(reference)) {
          return "unknown";
        }
        const name = reference.slice("#/$defs/".length),
          definition = localDefinitions[name];
        return isRecord(definition)
          ? schemaType(definition, localDefinitions, new Set([...visitedReferences, reference]))
          : "unknown";
      }
      throw new Error(`OpenAPI generator cannot resolve ${reference}`);
    }
    const definitions = isRecord(schema["$defs"])
        ? { ...localDefinitions, ...schema["$defs"] }
        : localDefinitions,
      oneOf = Array.isArray(schema["oneOf"]) ? schema["oneOf"] : undefined,
      anyOf = Array.isArray(schema["anyOf"]) ? schema["anyOf"] : undefined,
      allOf = Array.isArray(schema["allOf"]) ? schema["allOf"] : undefined;
    if (oneOf !== undefined || anyOf !== undefined) {
      const alternatives = oneOf ?? anyOf ?? [];
      return alternatives
        .map((alternative) =>
          isRecord(alternative)
            ? schemaType(alternative, definitions, visitedReferences)
            : "unknown",
        )
        .join(" | ");
    }
    if (allOf !== undefined) {
      return allOf
        .map((part) =>
          isRecord(part) ? schemaType(part, definitions, visitedReferences) : "unknown",
        )
        .join(" & ");
    }
    if (schema["const"] !== undefined) {
      return JSON.stringify(schema["const"]);
    }
    if (Array.isArray(schema["enum"])) {
      return schema["enum"].map((value) => JSON.stringify(value)).join(" | ");
    }
    const schemaTypeName = schema["type"];
    if (Array.isArray(schemaTypeName)) {
      return schemaTypeName
        .map((typeName) =>
          schemaType({ ...schema, type: typeName }, definitions, visitedReferences),
        )
        .join(" | ");
    }
    if (schemaTypeName === "string") {
      return "string";
    }
    if (schemaTypeName === "integer" || schemaTypeName === "number") {
      return "number";
    }
    if (schemaTypeName === "boolean") {
      return "boolean";
    }
    if (schemaTypeName === "null") {
      return "null";
    }
    if (schemaTypeName === "array") {
      const items = schema["items"];
      return `ReadonlyArray<${isRecord(items) ? schemaType(items, definitions, visitedReferences) : "unknown"}>`;
    }
    if (schemaTypeName === "object" || isRecord(schema["properties"])) {
      const properties = isRecord(schema["properties"]) ? schema["properties"] : {},
        required = new Set(
          Array.isArray(schema["required"])
            ? schema["required"].filter((value): value is string => typeof value === "string")
            : [],
        ),
        fields = Object.entries(properties).map(
          ([name, propertySchema]) =>
            `${typeProperty(name)}${required.has(name) ? "" : "?"}: ${
              isRecord(propertySchema)
                ? schemaType(propertySchema, definitions, visitedReferences)
                : "unknown"
            }`,
        ),
        additionalProperties = schema["additionalProperties"];
      if (fields.length === 0 && additionalProperties !== false) {
        return `Readonly<Record<string, ${
          isRecord(additionalProperties)
            ? schemaType(additionalProperties, definitions, visitedReferences)
            : "unknown"
        }>>`;
      }
      const objectType = `{ readonly ${fields.join("; readonly ")} }`;
      return isRecord(additionalProperties)
        ? `${objectType} & Readonly<Record<string, ${schemaType(
            additionalProperties,
            definitions,
            visitedReferences,
          )}>>`
        : objectType;
    }
    return "unknown";
  },
  parametersFrom = (value: unknown): readonly Parameter[] => {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.map((candidate) => {
      const parameter = requireRecord(candidate, "a parameter"),
        location = requireString(parameter["in"], "a parameter location");
      if (location !== "header" && location !== "path" && location !== "query") {
        throw new Error(`OpenAPI generator does not support ${location} parameters`);
      }
      return {
        location,
        name: requireString(parameter["name"], "a parameter name"),
        required: parameter["required"] === true,
        schema: requireRecord(parameter["schema"], "a parameter schema"),
      };
    });
  },
  contentSchema = (
    contentValue: unknown,
    description: string,
  ):
    | { readonly mediaType: string; readonly schema: Readonly<Record<string, unknown>> }
    | undefined => {
    if (contentValue === undefined) {
      return undefined;
    }
    const content = requireRecord(contentValue, `${description} content`),
      entries = Object.entries(content);
    if (entries.length !== 1) {
      throw new Error(`OpenAPI generator requires exactly one ${description} media type`);
    }
    const [mediaType, media] = entries[0]!,
      mediaRecord = requireRecord(media, `${description} media`);
    return { mediaType, schema: requireRecord(mediaRecord["schema"], `${description} schema`) };
  },
  sortedBy = <Value>(
    values: readonly Value[],
    compare: (left: Value, right: Value) => number,
  ): readonly Value[] => [...values].sort(compare),
  operationsFrom = (document: Readonly<Record<string, unknown>>): readonly GeneratedOperation[] => {
    const paths = requireRecord(document["paths"], "paths"),
      identifiers = new Set<string>(),
      operations: GeneratedOperation[] = [];
    for (const [path, methodsValue] of sortedBy(Object.entries(paths), ([left], [right]) =>
      left.localeCompare(right),
    )) {
      const methods = requireRecord(methodsValue, `methods for ${path}`);
      for (const [method, operationValue] of sortedBy(Object.entries(methods), ([left], [right]) =>
        left.localeCompare(right),
      )) {
        const operation = requireRecord(operationValue, `operation ${method} ${path}`),
          identifier = requireString(operation["operationId"], "an operation identifier");
        if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(identifier)) {
          throw new Error(
            `OpenAPI operation identifier is not a TypeScript identifier: ${identifier}`,
          );
        }
        if (identifiers.has(identifier)) {
          throw new Error(`Duplicate OpenAPI operation identifier: ${identifier}`);
        }
        identifiers.add(identifier);
        const responses = requireRecord(operation["responses"], `responses for ${identifier}`),
          successResponses = Object.entries(responses).filter(([status]) =>
            /^2\d\d$/u.test(status),
          );
        if (successResponses.length !== 1) {
          throw new Error(`OpenAPI operation ${identifier} requires exactly one 2xx response`);
        }
        const [successStatusText, successResponseValue] = successResponses[0]!,
          successResponse = requireRecord(
            successResponseValue,
            `success response for ${identifier}`,
          ),
          responseContent = contentSchema(successResponse["content"], "response"),
          requestBody =
            operation["requestBody"] === undefined
              ? undefined
              : requireRecord(operation["requestBody"], `request body for ${identifier}`),
          requestContent = contentSchema(requestBody?.["content"], "request");
        operations.push({
          identifier,
          method: method.toUpperCase(),
          parameters: parametersFrom(operation["parameters"]),
          path,
          requestBodyRequired: requestBody?.["required"] === true,
          ...(requestContent === undefined
            ? {}
            : {
                requestBodySchema: requestContent.schema,
                requestMediaType: requestContent.mediaType,
              }),
          ...(responseContent === undefined
            ? {}
            : {
                responseMediaType: responseContent.mediaType,
                responseSchema: responseContent.schema,
              }),
          successStatus: Number(successStatusText),
        });
      }
    }
    return sortedBy(operations, (left, right) => left.identifier.localeCompare(right.identifier));
  },
  parameterGroupType = (
    parameters: readonly Parameter[],
    location: Parameter["location"],
  ): { readonly required: boolean; readonly type: string } | undefined => {
    const selected = parameters.filter((parameter) => parameter.location === location);
    return selected.length === 0
      ? undefined
      : {
          required: selected.some((parameter) => parameter.required),
          type: `{ readonly ${selected
            .map(
              (parameter) =>
                `${typeProperty(parameter.name)}${parameter.required ? "" : "?"}: ${schemaType(
                  parameter.schema,
                )}`,
            )
            .join("; readonly ")} }`,
        };
  },
  operationInputType = (operation: GeneratedOperation): string => {
    const pathType = parameterGroupType(operation.parameters, "path"),
      queryType = parameterGroupType(operation.parameters, "query"),
      headerType = parameterGroupType(operation.parameters, "header"),
      fields = [
        ...(pathType === undefined ? [] : [`readonly path: ${pathType.type}`]),
        ...(queryType === undefined
          ? []
          : [`readonly query${queryType.required ? "" : "?"}: ${queryType.type}`]),
        ...(headerType === undefined
          ? []
          : [`readonly headers${headerType.required ? "" : "?"}: ${headerType.type}`]),
        ...(operation.requestBodySchema === undefined
          ? []
          : [
              `readonly body${operation.requestBodyRequired ? "" : "?"}: ${
                operation.requestMediaType === "multipart/form-data"
                  ? "FormData"
                  : schemaType(operation.requestBodySchema)
              }`,
            ]),
      ];
    return fields.length === 0 ? "Readonly<Record<never, never>>" : `{ ${fields.join("; ")} }`;
  },
  operationResponseType = (operation: GeneratedOperation): string =>
    operation.responseSchema === undefined
      ? "undefined"
      : operation.responseMediaType === "application/octet-stream"
        ? "Uint8Array"
        : schemaType(operation.responseSchema),
  componentTypes = (document: Readonly<Record<string, unknown>>): string => {
    const components = requireRecord(document["components"], "components"),
      componentSchemas = requireRecord(components["schemas"], "component schemas");
    return sortedBy(Object.entries(componentSchemas), ([left], [right]) =>
      left.localeCompare(right),
    )
      .map(([name, schema]) => {
        if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(name) || !isRecord(schema)) {
          throw new Error(`OpenAPI generator cannot emit component ${name}`);
        }
        return `export type ${name} = ${schemaType(schema)};`;
      })
      .join("\n");
  };

export const generateOpenApiClient = (documentValue: unknown): string => {
  const document = requireRecord(documentValue, "an OpenAPI document"),
    operations = operationsFrom(document),
    specifications = Object.fromEntries(
      operations.map((operation) => [
        operation.identifier,
        {
          method: operation.method,
          path: operation.path,
          requestMediaType: operation.requestMediaType,
          responseMediaType: operation.responseMediaType,
          successStatus: operation.successStatus,
        },
      ]),
    ),
    inputTypes = operations
      .map((operation) => `  readonly ${operation.identifier}: ${operationInputType(operation)};`)
      .join("\n"),
    responseTypes = operations
      .map(
        (operation) => `  readonly ${operation.identifier}: ${operationResponseType(operation)};`,
      )
      .join("\n"),
    methods = operations
      .map(
        (operation) =>
          `  ${operation.identifier}: (input: OperationInputs["${operation.identifier}"], signal?: AbortSignal): Effect.Effect<OperationResponses["${operation.identifier}"], TransportFailure | ProtocolFailure | DeclaredFailure> => requestOperation<"${operation.identifier}">(baseAddress, operationSpecifications.${operation.identifier}, input, signal),`,
      )
      .join("\n");
  return `// Generated by scripts/openapi-client-generator.ts. Do not edit.\nimport { Effect, Schema } from "effect";\n\nexport const generatorFormatVersion = ${generatorFormatVersion};\n\n${componentTypes(document)}\n\nexport interface OperationInputs {\n${inputTypes}\n}\n\nexport interface OperationResponses {\n${responseTypes}\n}\n\nexport class TransportFailure extends Schema.TaggedError<TransportFailure>()("TransportFailure", { message: Schema.String }) {}\nexport class ProtocolFailure extends Schema.TaggedError<ProtocolFailure>()("ProtocolFailure", { message: Schema.String, status: Schema.Number }) {}\nexport class DeclaredFailure extends Schema.TaggedError<DeclaredFailure>()("DeclaredFailure", { code: Schema.String, details: Schema.optional(Schema.Json), message: Schema.String, status: Schema.Number }) {}\n\ninterface OperationSpecification {\n  readonly method: string;\n  readonly path: string;\n  readonly requestMediaType?: string;\n  readonly responseMediaType?: string;\n  readonly successStatus: number;\n}\n\nconst operationSpecifications = ${JSON.stringify(specifications, null, 2)} satisfies Readonly<Record<keyof OperationInputs, OperationSpecification>>;\n\nfunction requestOperation<Identifier extends keyof OperationInputs>(\n  baseAddress: string,\n  specification: OperationSpecification,\n  input: OperationInputs[Identifier],\n  signal?: AbortSignal,\n): Effect.Effect<OperationResponses[Identifier], TransportFailure | ProtocolFailure | DeclaredFailure>;\nfunction requestOperation(\n  baseAddress: string,\n  specification: OperationSpecification,\n  input: OperationInputs[keyof OperationInputs],\n  signal?: AbortSignal,\n): Effect.Effect<unknown, TransportFailure | ProtocolFailure | DeclaredFailure> {\n  return Effect.tryPromise({\n      catch: (cause) =>\n        cause instanceof TransportFailure || cause instanceof ProtocolFailure || cause instanceof DeclaredFailure\n          ? cause\n          : TransportFailure.make({ message: cause instanceof Error ? cause.message : "Connection failed" }),\n      try: async () => {\n        let path = specification.path;\n        if ("path" in input && input.path !== undefined) {\n          for (const [name, value] of Object.entries(input.path)) {\n            path = path.replace(\`{\${name}}\`, encodeURIComponent(String(value)));\n          }\n        }\n        const requestUrl = new URL(\`\${baseAddress}\${path}\`, baseAddress || globalThis.location?.origin || "http://localhost");\n        if ("query" in input && input.query !== undefined) {\n          for (const [name, value] of Object.entries(input.query)) {\n            if (value !== undefined) requestUrl.searchParams.set(name, String(value));\n          }\n        }\n        const headers = new Headers("headers" in input ? input.headers : undefined);\n        let body: BodyInit | undefined;\n        if ("body" in input && input.body !== undefined) {\n          if (input.body instanceof FormData) body = input.body;\n          else {\n            headers.set("content-type", specification.requestMediaType ?? "application/json");\n            body = JSON.stringify(input.body);\n          }\n        }\n        let response: Response;\n        try {\n          response = await fetch(requestUrl, { body, headers, method: specification.method, signal });\n        } catch (cause) {\n          throw TransportFailure.make({ message: cause instanceof Error ? cause.message : "Connection failed" });\n        }\n        const mediaType = response.headers.get("content-type") ?? "";\n        if (response.status !== specification.successStatus) {\n          if (mediaType.includes("application/json")) {\n            const failure: unknown = await response.json();\n            if (failure !== null && typeof failure === "object" && "code" in failure && "message" in failure) {\n              throw DeclaredFailure.make({ code: String(failure.code), details: "details" in failure ? failure.details : undefined, message: String(failure.message), status: response.status });\n            }\n          }\n          throw ProtocolFailure.make({ message: \`Unexpected response status \${response.status}\`, status: response.status });\n        }\n        if (specification.successStatus === 204 || specification.method === "HEAD") return undefined;\n        if (specification.responseMediaType === "application/octet-stream") return new Uint8Array(await response.arrayBuffer());\n        if (!mediaType.includes("application/json")) throw ProtocolFailure.make({ message: "Expected application/json response", status: response.status });\n        try {\n          return await response.json();\n        } catch {\n          throw ProtocolFailure.make({ message: "Malformed JSON response", status: response.status });\n        }\n      },\n    });\n}\n\nexport const makeGeneratedClient = (baseAddress = "") => ({\n${methods}\n});\n`;
};
