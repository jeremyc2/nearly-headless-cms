import {
  type OperationChunk,
  generatedFileBanner,
  renderComponentTypes,
  sourceFileBuilders,
} from "./source-generate-assembly-imports.ts";
interface AssembleGeneratedFilesInput {
  readonly clientBasename: string;
  readonly document: Readonly<Record<string, unknown>>;
  readonly formatVersion: number;
  readonly inputChunks: readonly OperationChunk[];
  readonly operationMethods: string;
  readonly responseChunks: readonly OperationChunk[];
  readonly specificationChunks: readonly OperationChunk[];
}

const {
  buildEntryFile,
  buildMergedTypeFile,
  buildRuntimeSpecificationsFile,
  buildRuntimeTransportFile,
  buildRuntimeTypesFile,
  buildSpecificationTypesFile,
} = sourceFileBuilders,
  assembleGeneratedFiles = ({
    clientBasename,
    document,
    formatVersion,
    inputChunks,
    operationMethods,
    responseChunks,
    specificationChunks,
  }: AssembleGeneratedFilesInput): readonly { readonly content: string; readonly filename: string }[] => [
    buildComponentTypeFile(clientBasename, document),
    ...inputChunks.map(({ content, filename }) => ({ content, filename })),
    ...responseChunks.map(({ content, filename }) => ({ content, filename })),
    ...buildMergedTypeFiles(clientBasename, inputChunks, responseChunks),
    {
      content: buildSpecificationTypesFile(),
      filename: `${clientBasename}-specification-types`,
    },
    ...specificationChunks.map(({ content, filename }) => ({ content, filename })),
    {
      content: buildRuntimeSpecificationsFile({
        clientBasename,
        specificationImports: buildSpecificationImports(specificationChunks),
        specificationSpread: buildSpecificationSpread(specificationChunks),
      }),
      filename: `${clientBasename}-runtime-specifications`,
    },
    {
      content: buildRuntimeTypesFile(clientBasename),
      filename: `${clientBasename}-runtime-types`,
    },
    {
      content: buildRuntimeTransportFile(clientBasename, formatVersion, operationMethods),
      filename: `${clientBasename}-runtime-transport`,
    },
    {
      content: buildEntryFile(clientBasename),
      filename: clientBasename,
    },
  ],
  buildChunkImports = (
    chunks: readonly { readonly exportName: string; readonly filename: string }[],
  ): string =>
    chunks
      .map((chunk) => `import type { ${chunk.exportName} } from "./${chunk.filename}.ts";`)
      .join("\n"),
  buildComponentTypeFile = (
    clientBasename: string,
    document: Readonly<Record<string, unknown>>,
  ) => ({
    content: `${generatedFileBanner}${renderComponentTypes(document)}\n`,
    filename: `${clientBasename}-component-types`,
  }),
  buildMergedTypeFiles = (
    clientBasename: string,
    inputChunks: readonly OperationChunk[],
    responseChunks: readonly OperationChunk[],
  ) => [
    {
      content: buildMergedTypeFile({
        chunkImports: buildChunkImports(inputChunks),
        mergedType: buildMergedTypeName(inputChunks),
        typeName: "OperationInputs",
      }),
      filename: `${clientBasename}-operation-inputs`,
    },
    {
      content: buildMergedTypeFile({
        chunkImports: buildChunkImports(responseChunks),
        mergedType: buildMergedTypeName(responseChunks),
        typeName: "OperationResponses",
      }),
      filename: `${clientBasename}-operation-responses`,
    },
  ],
  buildMergedTypeName = (chunks: readonly { readonly exportName: string }[]): string =>
    chunks.map((chunk) => chunk.exportName).join(" & "),
  buildSpecificationImports = (
    specificationChunks: readonly { readonly exportName: string; readonly filename: string }[],
  ): string =>
    specificationChunks
      .map(
        (specificationChunk) =>
          `import { ${specificationChunk.exportName} } from "./${specificationChunk.filename}.ts";`,
      )
      .join("\n"),
  buildSpecificationSpread = (
    specificationChunks: readonly { readonly exportName: string }[],
  ): string =>
    specificationChunks
      .map((specificationChunk) => `...${specificationChunk.exportName}`)
      .join(",\n  ");

export { assembleGeneratedFiles };
export type { AssembleGeneratedFilesInput };
