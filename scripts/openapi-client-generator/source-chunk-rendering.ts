import {
  type GeneratedOperation,
  type OperationChunk,
  type RenderOperationChunksInput,
  chunkOperationCount,
  emptyItemCount,
  generatedFileBanner,
  jsonIndentation,
  sourceOperationRenderer,
} from "./source-chunk-rendering-imports.ts";

const renderComponentTypeImport = (
    clientBasename: string,
    componentSchemaNames: readonly string[],
    renderedSource: string,
  ): string => {
    const usedComponentSchemaNames = componentSchemaNames.filter((componentSchemaName) =>
      new RegExp(String.raw`\b${componentSchemaName}\b`, "u").test(renderedSource),
    );
    if (usedComponentSchemaNames.length === emptyItemCount) {
      return "";
    }
    return `import type { ${usedComponentSchemaNames.join(", ")} } from "./${clientBasename}-component-types.ts";\n`;
  },
  renderOperationChunks = ({
    clientBasename,
    componentSchemaNames,
    fileStem,
    operations,
    renderOperationFields,
  }: Readonly<RenderOperationChunksInput>): readonly OperationChunk[] => {
    let chunkLabel = "OperationResponses";
    if (fileStem === "operation-inputs") {
      chunkLabel = "OperationInputs";
    }
    const operationChunks: GeneratedOperation[][] = [];
    for (
      let chunkStartIndex = 0;
      chunkStartIndex < operations.length;
      chunkStartIndex += chunkOperationCount
    ) {
      operationChunks.push(
        operations.slice(chunkStartIndex, chunkStartIndex + chunkOperationCount),
      );
    }
    return operationChunks.map((operationChunk, chunkIndex) => {
      let exportName = `${chunkLabel}Chunk`;
      if (operationChunks.length > 1) {
        exportName = `${chunkLabel}Chunk${chunkIndex}`;
      }
      const filename = `${clientBasename}-${fileStem}-${chunkIndex}`,
        operationFields = operationChunk
          .map((operation) => renderOperationFields(operation))
          .join("\n");
      return {
        content: `${generatedFileBanner}${renderComponentTypeImport(clientBasename, componentSchemaNames, operationFields)}export interface ${exportName} {\n${operationFields}\n}\n`,
        exportName,
        filename,
      };
    });
  },
  renderOperationInputFields = (operation: GeneratedOperation): string =>
    `  readonly ${operation.identifier}: ${sourceOperationRenderer.operationInputType(operation)};`,
  renderOperationMethodFields = (operation: GeneratedOperation): string =>
    `  ${operation.identifier}: createOperationMethod(baseAddress, "${operation.identifier}"),`,
  renderOperationResponseFields = (operation: GeneratedOperation): string =>
    `  readonly ${operation.identifier}: ${sourceOperationRenderer.operationResponseType(operation)};`,
  renderSpecificationChunks = (
    clientBasename: string,
    operations: readonly GeneratedOperation[],
  ): readonly OperationChunk[] => {
    const specificationChunks: [string, unknown][][] = [],
      specificationEntries = Object.entries(
        sourceOperationRenderer.operationSpecifications(operations),
      );
    for (
      let chunkStartIndex = 0;
      chunkStartIndex < specificationEntries.length;
      chunkStartIndex += chunkOperationCount
    ) {
      specificationChunks.push(
        specificationEntries.slice(chunkStartIndex, chunkStartIndex + chunkOperationCount),
      );
    }
    return specificationChunks.map((specificationChunk, chunkIndex) => {
      let exportName = "operationSpecificationsChunk",
        filename = `${clientBasename}-specifications`;
      if (specificationChunks.length > 1) {
        exportName = `operationSpecificationsChunk${chunkIndex}`;
        filename = `${clientBasename}-specifications-${chunkIndex}`;
      }
      const specificationObject = JSON.stringify(
        Object.fromEntries(specificationChunk),
        null,
        jsonIndentation,
      );
      return {
        content: `${generatedFileBanner}export const ${exportName} = ${specificationObject} as const;\n`,
        exportName,
        filename,
      };
    });
  },
  sourceChunkRendering = {
    renderOperationChunks,
    renderOperationInputFields,
    renderOperationMethodFields,
    renderOperationResponseFields,
    renderSpecificationChunks,
  };

export {
  renderOperationChunks,
  renderOperationInputFields,
  renderOperationMethodFields,
  renderOperationResponseFields,
};

export default sourceChunkRendering;
