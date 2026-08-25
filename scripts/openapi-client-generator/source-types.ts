import type { GeneratedOperation, ParsedOpenApiDocument } from "./operations.ts";

interface GenerateClientSourceInput extends ParsedOpenApiDocument {
  readonly clientBasename: string;
  readonly formatVersion: number;
}

interface GeneratedClientFile {
  readonly content: string;
  readonly filename: string;
}

interface GeneratedClientSource {
  readonly files: readonly GeneratedClientFile[];
}

interface OperationChunk {
  readonly content: string;
  readonly exportName: string;
  readonly filename: string;
}

interface ParameterGroup {
  readonly required: boolean;
  readonly type: string;
}

interface RenderOperationChunksInput {
  readonly clientBasename: string;
  readonly componentSchemaNames: readonly string[];
  readonly fileStem: "operation-inputs" | "operation-responses";
  readonly operations: readonly GeneratedOperation[];
  readonly renderOperationFields: (operation: GeneratedOperation) => string;
}

export type {
  GenerateClientSourceInput,
  GeneratedClientFile,
  GeneratedClientSource,
  OperationChunk,
  ParameterGroup,
  RenderOperationChunksInput,
};
