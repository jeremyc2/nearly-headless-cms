export interface Parameter {
  readonly location: "header" | "path" | "query";
  readonly name: string;
  readonly required: boolean;
  readonly schema: Readonly<Record<string, unknown>>;
}

export interface GeneratedSuccessResponse {
  readonly mediaType?: string;
  readonly schema?: Readonly<Record<string, unknown>>;
  readonly status: number;
}

export interface GeneratedOperation {
  readonly identifier: string;
  readonly method: string;
  readonly parameters: readonly Parameter[];
  readonly path: string;
  readonly requestBodyRequired: boolean;
  readonly requestBodySchema?: Readonly<Record<string, unknown>>;
  readonly requestMediaType?: string;
  readonly successResponses: readonly GeneratedSuccessResponse[];
}

export interface ParsedOpenApiDocument {
  readonly document: Readonly<Record<string, unknown>>;
  readonly operations: readonly GeneratedOperation[];
}

interface ContentSchema {
  readonly mediaType: string;
  readonly schema: Readonly<Record<string, unknown>>;
}

interface OperationInput {
  readonly identifier: string;
  readonly method: string;
  readonly operation: Readonly<Record<string, unknown>>;
  readonly path: string;
}

interface PathOperationsInput {
  readonly identifiers: Set<string>;
  readonly methods: Readonly<Record<string, unknown>>;
  readonly path: string;
}

const emptyItemCount = 0,
  isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    value !== null && typeof value === "object" && !Array.isArray(value),
  requireRecord = (value: unknown, description: string): Readonly<Record<string, unknown>> => {
    if (!isRecord(value)) {
      throw new Error(`OpenAPI generator expected ${description}`);
    }
    return value;
  },
  requireString = (value: unknown, description: string): string => {
    if (typeof value !== "string") {
      throw new TypeError(`OpenAPI generator expected ${description}`);
    }
    return value;
  },
  singleItemCount = 1,
  sortedValues = <Value>(
    values: readonly Value[],
    compare: (left: Value, right: Value) => number,
  ): readonly Value[] => values.toSorted(compare),
  validatedContent = (contentValue: unknown, description: string): ContentSchema | undefined => {
    if (contentValue === undefined) {
      return undefined;
    }
    const content = requireRecord(contentValue, `${description} content`),
      entries = Object.entries(content),
      [firstEntry] = entries;
    if (entries.length !== singleItemCount || firstEntry === undefined) {
      throw new Error(`OpenAPI generator requires exactly one ${description} media type`);
    }
    {
      const [mediaType, media] = firstEntry,
        mediaRecord = requireRecord(media, `${description} media`);
      return { mediaType, schema: requireRecord(mediaRecord["schema"], `${description} schema`) };
    }
  },
  validatedParameters = (value: unknown): readonly Parameter[] => {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.map((candidate) => {
      const parameter = requireRecord(candidate, "a parameter"),
        parameterLocation = requireString(parameter["in"], "a parameter location");
      if (
        parameterLocation !== "header" &&
        parameterLocation !== "path" &&
        parameterLocation !== "query"
      ) {
        throw new Error(`OpenAPI generator does not support ${parameterLocation} parameters`);
      }
      return {
        location: parameterLocation,
        name: requireString(parameter["name"], "a parameter name"),
        required: parameter["required"] === true,
        schema: requireRecord(parameter["schema"], "a parameter schema"),
      };
    });
  },
  validatedRequestBody = (
    operation: Readonly<Record<string, unknown>>,
    identifier: string,
  ): Readonly<Record<string, unknown>> | undefined => {
    if (operation["requestBody"] === undefined) {
      return undefined;
    }
    return requireRecord(operation["requestBody"], `request body for ${identifier}`);
  },
  validatedResponses = (
    operation: Readonly<Record<string, unknown>>,
    identifier: string,
  ): readonly GeneratedSuccessResponse[] => {
    const responses = requireRecord(operation["responses"], `responses for ${identifier}`),
      successfulResponses = Object.entries(responses).filter(([status]) => /^2\d\d$/u.test(status));
    if (successfulResponses.length === emptyItemCount) {
      throw new Error(`OpenAPI operation ${identifier} requires at least one 2xx response`);
    }
    return sortedValues(
      successfulResponses,
      ([leftStatus], [rightStatus]) => Number(leftStatus) - Number(rightStatus),
    ).map(([statusText, responseValue]) => {
      const response = requireRecord(responseValue, `success response for ${identifier}`),
        responseContent = validatedContent(response["content"], "response"),
        status = Number(statusText);
      if (responseContent === undefined) {
        return { status };
      }
      return {
        mediaType: responseContent.mediaType,
        schema: responseContent.schema,
        status,
      };
    });
  },
  validatedSingleOperation = ({
    identifier,
    method,
    operation,
    path,
  }: Readonly<OperationInput>): GeneratedOperation => {
    const requestBody = validatedRequestBody(operation, identifier),
      requestContent = validatedContent(requestBody?.["content"], "request"),
      sharedOperation: GeneratedOperation = {
        identifier,
        method: method.toUpperCase(),
        parameters: validatedParameters(operation["parameters"]),
        path,
        requestBodyRequired: requestBody?.["required"] === true,
        successResponses: validatedResponses(operation, identifier),
      };
    if (requestContent === undefined) {
      return sharedOperation;
    }
    return {
      ...sharedOperation,
      requestBodySchema: requestContent.schema,
      requestMediaType: requestContent.mediaType,
    };
  },
  validatedTraversalPathOperations = ({
    identifiers,
    methods,
    path,
  }: Readonly<PathOperationsInput>): readonly GeneratedOperation[] =>
    sortedValues(Object.entries(methods), ([leftMethod], [rightMethod]) =>
      leftMethod.localeCompare(rightMethod),
    ).map(([method, operationValue]) => {
      const operation = requireRecord(operationValue, `operation ${method} ${path}`),
        operationIdentifier = requireString(operation["operationId"], "an operation identifier");
      if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(operationIdentifier)) {
        throw new Error(
          `OpenAPI operation identifier is not a TypeScript identifier: ${operationIdentifier}`,
        );
      }
      if (identifiers.has(operationIdentifier)) {
        throw new Error(`Duplicate OpenAPI operation identifier: ${operationIdentifier}`);
      }
      identifiers.add(operationIdentifier);
      return validatedSingleOperation({ identifier: operationIdentifier, method, operation, path });
    }),
  zParseOpenApiDocument = (documentValue: unknown): ParsedOpenApiDocument => {
    const document = requireRecord(documentValue, "an OpenAPI document"),
      identifiers = new Set<string>(),
      paths = requireRecord(document["paths"], "paths"),
      pathsOperations = sortedValues(Object.entries(paths), ([leftPath], [rightPath]) =>
        leftPath.localeCompare(rightPath),
      )
        .flatMap(([path, methodsValue]) =>
          validatedTraversalPathOperations({
            identifiers,
            methods: requireRecord(methodsValue, `methods for ${path}`),
            path,
          }),
        )
        .toSorted((leftOperation, rightOperation) =>
          leftOperation.identifier.localeCompare(rightOperation.identifier),
        );
    return { document, operations: pathsOperations };
  };

/** Validates and normalizes the OpenAPI operations consumed by source emission. */
export { zParseOpenApiDocument as parseOpenApiDocument };
