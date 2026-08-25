import {
  type GenerateClientSourceInput,
  type GeneratedClientSource,
  assembleGeneratedFiles,
  listComponentSchemaNames,
  sourceChunkRendering,
} from "./source-generate-imports.ts";

const {
    renderOperationChunks,
    renderOperationInputFields,
    renderOperationMethodFields,
    renderOperationResponseFields,
    renderSpecificationChunks,
  } = sourceChunkRendering,
  buildOperationMethodSource = (operations: GenerateClientSourceInput["operations"]): string =>
    operations.map((operation) => renderOperationMethodFields(operation)).join("\n"),
  generateClientSource = ({
    clientBasename,
    document,
    formatVersion,
    operations,
  }: Readonly<GenerateClientSourceInput>): GeneratedClientSource => {
    const componentSchemaNames = listComponentSchemaNames(document),
      inputChunks = renderOperationChunks({
        clientBasename,
        componentSchemaNames,
        fileStem: "operation-inputs",
        operations,
        renderOperationFields: renderOperationInputFields,
      }),
      operationMethods = buildOperationMethodSource(operations),
      responseChunks = renderOperationChunks({
        clientBasename,
        componentSchemaNames,
        fileStem: "operation-responses",
        operations,
        renderOperationFields: renderOperationResponseFields,
      }),
      specificationChunks = renderSpecificationChunks(clientBasename, operations);
    return {
      files: assembleGeneratedFiles({
        clientBasename,
        document,
        formatVersion,
        inputChunks,
        operationMethods,
        responseChunks,
        specificationChunks,
      }),
    };
  };

export { generateClientSource };
