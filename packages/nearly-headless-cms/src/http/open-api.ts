import {
  type DeliveryOperation,
  type ManagementOperation,
  headlessPrefix,
} from "./http-contract.ts";
import type { Document, OperationDescriptor } from "./open-api-types.ts";
import openApiManagementPaths from "./open-api-management-paths.ts";
import openApiOperationSupport from "./open-api-operation-support.ts";
import openApiSchemas from "./open-api-schemas.ts";

const { managementPaths } = openApiManagementPaths,
  { completePaths, customDescriptor, descriptor } = openApiOperationSupport,
  { indentationSpaces, schemas } = openApiSchemas,
  aSortedEntries = (value: object): readonly (readonly [string, unknown])[] =>
    Object.entries(value).toSorted(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey)),
  bSortValue = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map((entry) => bSortValue(entry));
    }
    if (value === null || typeof value !== "object") {
      return value;
    }
    return Object.fromEntries(
      aSortedEntries(value).map(([key, child]) => [key, bSortValue(child)]),
    );
  },
  cHeadlessPaths = (
    operations: readonly DeliveryOperation[],
  ): Readonly<Record<string, Readonly<Record<string, OperationDescriptor>>>> =>
    operations.reduce<Record<string, Record<string, OperationDescriptor>>>(
      (paths, operation) => {
        const path = `${headlessPrefix}${operation.path}`;
        paths[path] = {
          ...paths[path],
          [operation.method.toLowerCase()]: customDescriptor(operation),
        };
        return paths;
      },
      {
        [`${headlessPrefix}/schema`]: {
          get: descriptor("discoverPublicDefinitionSnapshot"),
        },
      },
    ),
  /** Builds an OpenAPI document containing only declared Headless Delivery Operations. */
  headless = (operations: readonly DeliveryOperation[]): Document => ({
    components: { schemas },
    info: { title: "Nearly Headless CMS Headless API", version: "1.0.0" },
    openapi: "3.1.0",
    paths: completePaths(cHeadlessPaths(operations)),
  }),
  /** Builds the complete generic plus Builder-defined Management OpenAPI document. */
  management = (operations: readonly ManagementOperation[] = []): Document => ({
    components: { schemas },
    info: { title: "Nearly Headless CMS Management API", version: "1.0.0" },
    openapi: "3.1.0",
    paths: completePaths(managementPaths(operations)),
  }),
  /** Serializes an OpenAPI document with deterministic recursively sorted object keys. */
  stringify = (document: Document): string =>
    `${JSON.stringify(bSortValue(document), null, indentationSpaces)}\n`;

export { headless, management, stringify };
export type { Document } from "./open-api-types.ts";
