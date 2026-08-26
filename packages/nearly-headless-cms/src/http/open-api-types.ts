import type { OperationSchemas } from "./http-contract.ts";

/** Deterministic OpenAPI 3.1 document for one versioned HTTP contract. */
export interface Document {
  readonly openapi: "3.1.0";
  readonly info: { readonly title: string; readonly version: "1.0.0" };
  readonly paths: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  readonly components: { readonly schemas: Readonly<Record<string, unknown>> };
}

export interface OperationDescriptor {
  readonly operationIdentifier: string;
  readonly schemas?: OperationSchemas;
  readonly successStatus?: number;
}
