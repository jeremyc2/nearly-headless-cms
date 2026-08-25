import {
  generatedFileBanner,
  runtimeAfterMakeGeneratedClient,
  runtimeBeforeSpecifications,
  runtimeConstChainMiddle,
  runtimeRequestOperation,
  runtimeTypes,
} from "./source-file-builders-imports.ts";

interface BuildMergedTypeFileInput {
  readonly chunkImports: string;
  readonly mergedType: string;
  readonly typeName: "OperationInputs" | "OperationResponses";
}

interface BuildRuntimeSpecificationsFileInput {
  readonly clientBasename: string;
  readonly specificationImports: string;
  readonly specificationSpread: string;
}

const buildEntryFile = (clientBasename: string): string =>
    `${generatedFileBanner}export { DeclaredFailure } from "./declared-failure.ts";
export { ProtocolFailure } from "./protocol-failure.ts";
export { TransportFailure } from "./transport-failure.ts";
export * from "./${clientBasename}-component-types.ts";
export type { OperationInputs } from "./${clientBasename}-operation-inputs.ts";
export type { OperationResponses } from "./${clientBasename}-operation-responses.ts";
export { generatorFormatVersion, makeGeneratedClient } from "./${clientBasename}-runtime-transport.ts";
`,
  buildMergedTypeFile = ({
    chunkImports,
    mergedType,
    typeName,
  }: Readonly<BuildMergedTypeFileInput>): string =>
    `${generatedFileBanner}${chunkImports}\nexport type ${typeName} = ${mergedType};\n`,
  buildRuntimeSpecificationsFile = ({
    clientBasename,
    specificationImports,
    specificationSpread,
  }: Readonly<BuildRuntimeSpecificationsFileInput>): string =>
    `${generatedFileBanner}import type { OperationInputs } from "./${clientBasename}-operation-inputs.ts";
import type { OperationSpecification } from "./${clientBasename}-specification-types.ts";
${specificationImports}

export const operationSpecifications = {
  ${specificationSpread},
} satisfies Readonly<Record<keyof OperationInputs, OperationSpecification>>;
`,
  buildRuntimeTransportFile = (
    clientBasename: string,
    formatVersion: number,
    operationMethods: string,
  ): string =>
    `${generatedFileBanner}import { Effect, Schema } from "effect";
import type {
  OperationFetchRequest,
  OperationRequestInput,
  OperationSuccessParseInput,
  RequestOperationInput,
} from "./${clientBasename}-runtime-types.ts";
import { DeclaredFailure } from "./declared-failure.ts";
import type { OperationInputs } from "./${clientBasename}-operation-inputs.ts";
import type { OperationResponses } from "./${clientBasename}-operation-responses.ts";
import type { OperationSpecification } from "./${clientBasename}-specification-types.ts";
import { ProtocolFailure } from "./protocol-failure.ts";
import { TransportFailure } from "./transport-failure.ts";
import { operationSpecifications } from "./${clientBasename}-runtime-specifications.ts";

/* oxlint-disable effecttsgo/async-function -- [EH-026] generated clients expose a Promise-backed transport boundary. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- [EH-176] generated operation inputs include platform types that cannot satisfy deep readonly. */
/* oxlint-disable eslint/sort-vars -- [EH-130] generated runtime helpers are ordered for readability. */
/* oxlint-disable eslint/max-lines -- [EH-115] generated transport runtime exceeds local module line budget. */
/* oxlint-disable eslint/no-ternary -- [EH-123] generated fetch bridge keeps compact signal fallback. */

${runtimeBeforeSpecifications}  generatorFormatVersion = ${formatVersion},
  httpStatusNoContent = 204,
${runtimeConstChainMiddle}  makeGeneratedClient = (baseAddress = "") => ({
${operationMethods}
  }),
${runtimeAfterMakeGeneratedClient}

${runtimeRequestOperation}
export { generatorFormatVersion, makeGeneratedClient };
`,
  buildRuntimeTypesFile = (clientBasename: string): string =>
    `${generatedFileBanner}import type { OperationInputs } from "./${clientBasename}-operation-inputs.ts";
import type { OperationSpecification } from "./${clientBasename}-specification-types.ts";

${runtimeTypes}`,
  buildSpecificationTypesFile = (): string =>
    `${generatedFileBanner}export interface OperationSpecification {
  readonly method: string;
  readonly path: string;
  readonly requestMediaType?: string;
  readonly successResponses: readonly {
    readonly responseMediaType?: string;
    readonly status: number;
  }[];
}
`,
  sourceFileBuilders = {
    buildEntryFile,
    buildMergedTypeFile,
    buildRuntimeSpecificationsFile,
    buildRuntimeTransportFile,
    buildRuntimeTypesFile,
    buildSpecificationTypesFile,
  };

export default sourceFileBuilders;
export type { BuildMergedTypeFileInput, BuildRuntimeSpecificationsFileInput };
