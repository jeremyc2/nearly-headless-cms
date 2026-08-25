import type { GeneratedOperation, GeneratedSuccessResponse, Parameter } from "./operations.ts";
import { renderSchemaType, renderTypeProperty } from "./schema-types.ts";
import { emptyItemCount } from "./source-constants.ts";

const sourceOperationRenderer = {
  appendParameterGroup(
    fields: string[],
    name: "headers" | "path" | "query",
    group: { readonly required: boolean; readonly type: string } | null,
  ) {
    if (group === null) {
      return;
    }
    fields.push(
      `readonly ${sourceOperationRenderer.propertyField(name, group.type, group.required)}`,
    );
  },
  appendRequestBody(fields: string[], operation: GeneratedOperation) {
    if (operation.requestBodySchema === undefined) {
      return;
    }
    let bodyType = renderSchemaType(operation.requestBodySchema);
    if (operation.requestMediaType === "multipart/form-data") {
      bodyType = "FormData";
    }
    fields.push(
      `readonly ${sourceOperationRenderer.propertyField("body", bodyType, operation.requestBodyRequired)}`,
    );
  },
  operationInputType(operation: GeneratedOperation) {
    const fields: string[] = [],
      headerType = sourceOperationRenderer.parameterGroupType(operation.parameters, "header"),
      pathType = sourceOperationRenderer.parameterGroupType(operation.parameters, "path"),
      queryType = sourceOperationRenderer.parameterGroupType(operation.parameters, "query");
    sourceOperationRenderer.appendParameterGroup(fields, "path", pathType);
    sourceOperationRenderer.appendParameterGroup(fields, "query", queryType);
    sourceOperationRenderer.appendParameterGroup(fields, "headers", headerType);
    sourceOperationRenderer.appendRequestBody(fields, operation);
    if (fields.length === emptyItemCount) {
      return "Readonly<Record<never, never>>";
    }
    return `{ ${fields.join("; ")} }`;
  },
  operationResponseType(operation: GeneratedOperation) {
    return [
      ...new Set(
        operation.successResponses.map((response) =>
          sourceOperationRenderer.successResponseType(response),
        ),
      ),
    ].join(" | ");
  },
  operationSpecifications(operations: readonly GeneratedOperation[]) {
    return Object.fromEntries(
      operations.map((operation) => [
        operation.identifier,
        {
          method: operation.method,
          path: operation.path,
          requestMediaType: operation.requestMediaType,
          successResponses: operation.successResponses.map(({ mediaType, status }) => ({
            responseMediaType: mediaType,
            status,
          })),
        },
      ]),
    );
  },
  parameterGroupType(parameters: readonly Parameter[], location: Parameter["location"]) {
    const selectedParameters = parameters.filter((parameter) => parameter.location === location);
    if (selectedParameters.length === emptyItemCount) {
      return null;
    }
    return {
      required: selectedParameters.some((parameter) => parameter.required),
      type: `{ readonly ${selectedParameters
        .map((parameter) =>
          sourceOperationRenderer.propertyField(
            renderTypeProperty(parameter.name),
            renderSchemaType(parameter.schema),
            parameter.required,
          ),
        )
        .join("; readonly ")} }`,
    };
  },
  propertyField(name: string, type: string, required: boolean) {
    let optionalSuffix = "?";
    if (required) {
      optionalSuffix = "";
    }
    return `${name}${optionalSuffix}: ${type}`;
  },
  successResponseType(response: GeneratedSuccessResponse) {
    if (response.schema === undefined) {
      return "undefined";
    }
    if (response.mediaType === "application/octet-stream") {
      return "Uint8Array";
    }
    return renderSchemaType(response.schema);
  },
};

export { sourceOperationRenderer };
