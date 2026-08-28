interface BuildCompletedOperationInput {
  readonly bodyless: boolean;
  readonly firstIndex: number;
  readonly operationIdentifier: string;
  readonly parameters: readonly unknown[];
  readonly requestBodySchema: Readonly<Record<string, unknown>> | undefined;
  readonly requestMediaType: string;
  readonly responseMediaType: string;
  readonly responseSchema: Readonly<Record<string, unknown>>;
  readonly successStatus: number;
}

const presignedUploadMetadataSchema = {
    properties: {
      defaultAlternativeText: { type: "string" },
      filename: { type: "string" },
      height: { type: "number" },
      mediaType: { type: "string" },
      width: { type: "number" },
    },
    required: ["filename", "mediaType"],
    type: "object",
  },
  requestBodyContent = (
    operationIdentifier: string,
    requestMediaType: string,
    requestBodySchema: Readonly<Record<string, unknown>>,
  ): Readonly<Record<string, unknown>> => {
    const content = { [requestMediaType]: { schema: requestBodySchema } };
    if (operationIdentifier !== "ingestAsset") {
      return content;
    }
    return {
      ...content,
      "application/json": { schema: presignedUploadMetadataSchema },
    };
  },

 buildCompletedOperation = ({
  bodyless,
  firstIndex,
  operationIdentifier,
  parameters,
  requestBodySchema,
  requestMediaType,
  responseMediaType,
  responseSchema,
  successStatus,
  operationResponses,
  conditionalValue,
}: BuildCompletedOperationInput & {
  readonly conditionalValue: <Value>(
    condition: boolean,
    whenTrue: Value,
    whenFalse: Value,
  ) => Value;
  readonly operationResponses: (input: {
    readonly bodyless: boolean;
    readonly operationIdentifier: string;
    readonly responseMediaType: string;
    readonly responseSchema: Readonly<Record<string, unknown>>;
    readonly successStatus: number;
  }) => Readonly<Record<string, unknown>>;
}): Readonly<Record<string, unknown>> => {
  const operation: Record<string, unknown> = {
    operationId: operationIdentifier,
    ...conditionalValue(parameters.length === firstIndex, {}, { parameters }),
    responses: operationResponses({
      bodyless,
      operationIdentifier,
      responseMediaType,
      responseSchema,
      successStatus,
    }),
  };
  if (requestBodySchema !== undefined) {
    operation["requestBody"] = {
      content: requestBodyContent(operationIdentifier, requestMediaType, requestBodySchema),
      required: true,
    };
  }
  return operation;
};

export default buildCompletedOperation;
