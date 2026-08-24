import { Schema } from "effect";
import {
  type DeliveryOperation,
  type ManagementOperation,
  type OperationSchema,
  type OperationSchemas,
  headlessPrefix,
  managementPrefix,
} from "./http-contract.ts";

/** Deterministic OpenAPI 3.1 document for one versioned HTTP contract. */
export interface Document {
  readonly openapi: "3.1.0";
  readonly info: { readonly title: string; readonly version: "1.0.0" };
  readonly paths: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  readonly components: { readonly schemas: Readonly<Record<string, unknown>> };
}

interface OperationDescriptor {
  readonly operationIdentifier: string;
  readonly schemas?: OperationSchemas;
  readonly successStatus?: number;
}

const errorSchema = {
    properties: {
      code: { type: "string" },
      details: {},
      message: { type: "string" },
      requestId: { type: "string" },
    },
    required: ["code", "message", "requestId"],
    type: "object",
  },
  entrySchema = {
    properties: {
      contentTypeId: { type: "string" },
      id: { type: "string" },
      values: { additionalProperties: true, type: "object" },
    },
    required: ["contentTypeId", "id", "values"],
    type: "object",
  },
  schemas = {
    Asset: {
      properties: {
        id: { type: "string" },
        metadata: {
          properties: {
            byteLength: { minimum: 0, type: "integer" },
            defaultAlternativeText: { type: "string" },
            digest: { type: "string" },
            filename: { type: "string" },
            height: { minimum: 1, type: "integer" },
            mediaType: { type: "string" },
            width: { minimum: 1, type: "integer" },
          },
          required: ["filename", "mediaType", "byteLength", "digest"],
          type: "object",
        },
      },
      required: ["id", "metadata"],
      type: "object",
    },
    CatalogPage: {
      properties: {
        catalogVersion: { minimum: 1, type: "integer" },
        items: { items: { $ref: "#/components/schemas/JsonObject" }, type: "array" },
        nextCursor: { type: "string" },
      },
      required: ["catalogVersion", "items"],
      type: "object",
    },
    CurrentEntryState: {
      properties: {
        entry: { $ref: "#/components/schemas/Entry" },
        revisionNumber: { minimum: 1, type: "integer" },
        writeToken: { type: "string" },
      },
      required: ["entry", "revisionNumber", "writeToken"],
      type: "object",
    },
    Discovery: {
      additionalProperties: false,
      properties: {
        apiContractVersion: { const: 1, type: "integer" },
        definitionFingerprint: { type: "string" },
        definitionSnapshotId: { type: "string" },
        definitions: { items: { $ref: "#/components/schemas/JsonObject" }, type: "array" },
        fieldKinds: { items: { $ref: "#/components/schemas/JsonObject" }, type: "array" },
        openApiUrl: { type: "string" },
        operations: { items: { $ref: "#/components/schemas/JsonObject" }, type: "array" },
        richText: { $ref: "#/components/schemas/JsonObject" },
      },
      required: [
        "apiContractVersion",
        "definitionFingerprint",
        "definitionSnapshotId",
        "definitions",
        "fieldKinds",
        "operations",
        "richText",
        "openApiUrl",
      ],
      type: "object",
    },
    Entry: entrySchema,
    EntryPage: {
      properties: {
        items: { items: { $ref: "#/components/schemas/Entry" }, type: "array" },
        nextCursor: { type: "string" },
      },
      required: ["items"],
      type: "object",
    },
    Error: errorSchema,
    JsonObject: { additionalProperties: true, type: "object" },
    MutationResult: {
      oneOf: [
        { $ref: "#/components/schemas/Entry" },
        { $ref: "#/components/schemas/CurrentEntryState" },
      ],
    },
    Revision: {
      properties: {
        recordedAt: { format: "date-time", type: "string" },
        revisionNumber: { minimum: 1, type: "integer" },
        values: { $ref: "#/components/schemas/JsonObject" },
      },
      required: ["revisionNumber", "recordedAt", "values"],
      type: "object",
    },
    RevisionPage: {
      properties: {
        items: { items: { $ref: "#/components/schemas/Revision" }, type: "array" },
        nextCursor: { type: "string" },
      },
      required: ["items"],
      type: "object",
    },
  },
  successStatuses = new Map<string, number>([
    ["createEntry", 201],
    ["ingestAsset", 201],
    ["appendDefinitionRevision", 201],
    ["retireDefinition", 201],
    ["activateDefinitionSnapshot", 201],
    ["appendMigrationManifest", 201],
    ["deleteEntry", 204],
    ["deleteAsset", 204],
    ["permanentlyPurgeEntry", 204],
  ]),
  successSchemas = new Map<string, Readonly<Record<string, unknown>>>([
    ["createEntry", { $ref: "#/components/schemas/MutationResult" }],
    ["getEntry", { $ref: "#/components/schemas/Entry" }],
    ["readEntry", { $ref: "#/components/schemas/Entry" }],
    ["replaceEntry", { $ref: "#/components/schemas/MutationResult" }],
    ["queryEntries", { $ref: "#/components/schemas/EntryPage" }],
    ["getCurrentEntryState", { $ref: "#/components/schemas/CurrentEntryState" }],
    ["listEntryRevisions", { $ref: "#/components/schemas/RevisionPage" }],
    ["inspectEntryRevision", { $ref: "#/components/schemas/Revision" }],
    ["restoreEntryRevision", { $ref: "#/components/schemas/CurrentEntryState" }],
    ["ingestAsset", { $ref: "#/components/schemas/Asset" }],
    ["getAsset", { $ref: "#/components/schemas/Asset" }],
    ["readAsset", { format: "binary", type: "string" }],
    ["inspectAssetContent", { format: "binary", type: "string" }],
    ["discoverPublicDefinitionSnapshot", { $ref: "#/components/schemas/Discovery" }],
  ]),
  requestBodySchemas = new Map<string, Readonly<Record<string, unknown>>>([
    [
      "createEntry",
      {
        properties: { values: { $ref: "#/components/schemas/JsonObject" } },
        required: ["values"],
        type: "object",
      },
    ],
    [
      "replaceEntry",
      {
        properties: { values: { $ref: "#/components/schemas/JsonObject" } },
        required: ["values"],
        type: "object",
      },
    ],
    ["readEntry", { $ref: "#/components/schemas/JsonObject" }],
    ["queryEntries", { $ref: "#/components/schemas/JsonObject" }],
    [
      "restoreEntryRevision",
      {
        properties: {
          revisionNumber: { minimum: 1, type: "integer" },
          writeToken: { type: "string" },
        },
        required: ["revisionNumber", "writeToken"],
        type: "object",
      },
    ],
    [
      "permanentlyPurgeEntry",
      {
        properties: { writeToken: { type: "string" } },
        required: ["writeToken"],
        type: "object",
      },
    ],
    [
      "ingestAsset",
      {
        properties: {
          content: { format: "binary", type: "string" },
          metadata: { $ref: "#/components/schemas/JsonObject" },
        },
        required: ["metadata", "content"],
        type: "object",
      },
    ],
  ]),
  paginatedOperations = new Set([
    "listEntryRevisions",
    "listDefinitions",
    "listDefinitionRevisions",
    "listDefinitionSnapshots",
    "listCatalogEvents",
    "listMigrationManifests",
  ]),
  writeTokenHeaderOperations = new Set(["replaceEntry", "deleteEntry"]),
  errorResponses = (): Readonly<Record<string, unknown>> =>
    Object.fromEntries(
      [
        ["400", "Invalid input"],
        ["403", "Forbidden"],
        ["404", "Not found"],
        ["405", "Method not allowed"],
        ["406", "Not acceptable"],
        ["408", "Request timeout"],
        ["409", "Conflict"],
        ["412", "Definition Snapshot changed"],
        ["413", "Payload too large"],
        ["414", "URI too long"],
        ["415", "Unsupported request media type"],
        ["422", "Unsupported query capability"],
        ["431", "Request headers too large"],
        ["500", "Internal error"],
        ["503", "Retryable infrastructure failure"],
      ].map(([status, description]) => [
        status,
        {
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/Error" } },
          },
          description,
        },
      ]),
    ),
  effectSchema = (schema: OperationSchema): Readonly<Record<string, unknown>> => {
    const document = Schema.toJsonSchemaDocument(schema);
    return Object.keys(document.definitions).length === 0
      ? document.schema
      : { ...document.schema, $defs: document.definitions };
  },
  pathParameters = (
    path: string,
    operationSchemas?: OperationSchemas,
  ): readonly Readonly<Record<string, unknown>>[] =>
    [...path.matchAll(/\{([^}]+)\}/gu)].map((match) => {
      const parameterName = match[1]!,
        declaredSchema = operationSchemas?.pathParameters?.[parameterName];
      return {
        in: "path",
        name: parameterName,
        required: true,
        schema:
          declaredSchema === undefined
            ? { type: parameterName === "revisionNumber" ? "integer" : "string" }
            : effectSchema(declaredSchema),
      };
    }),
  queryParameters = (
    operationIdentifier: string,
    operationSchemas?: OperationSchemas,
  ): readonly Readonly<Record<string, unknown>>[] => {
    const declared =
      operationSchemas?.queryParameters ??
      (paginatedOperations.has(operationIdentifier)
        ? { cursor: Schema.String, pageSize: Schema.Int }
        : {});
    return Object.entries(declared).map(([name, schema]) => ({
      in: "query",
      name,
      required: false,
      schema: effectSchema(schema),
    }));
  },
  headerParameters = (
    operationIdentifier: string,
    operationSchemas?: OperationSchemas,
  ): readonly Readonly<Record<string, unknown>>[] => {
    const declared = {
      "CMS-Expected-Definition-Fingerprint": Schema.String,
      "X-Request-Id": Schema.String,
      ...(writeTokenHeaderOperations.has(operationIdentifier)
        ? { "CMS-Write-Token": Schema.String }
        : {}),
      ...operationSchemas?.requestHeaders,
    };
    return Object.entries(declared).map(([name, schema]) => ({
      in: "header",
      name,
      required: name !== "CMS-Expected-Definition-Fingerprint" && name !== "X-Request-Id",
      schema: effectSchema(schema),
    }));
  },
  completeOperation = (
    path: string,
    method: string,
    operationDescriptor: OperationDescriptor,
  ): Readonly<Record<string, unknown>> => {
    const operationIdentifier = operationDescriptor.operationIdentifier,
      successStatus =
        operationDescriptor.successStatus ?? successStatuses.get(operationIdentifier) ?? 200,
      bodyless = method === "head" || successStatus === 204,
      parameters = [
        ...pathParameters(path, operationDescriptor.schemas),
        ...queryParameters(operationIdentifier, operationDescriptor.schemas),
        ...headerParameters(operationIdentifier, operationDescriptor.schemas),
      ],
      declaredRequestBody = operationDescriptor.schemas?.requestBody,
      requestBodySchema =
        declaredRequestBody === undefined
          ? requestBodySchemas.get(operationIdentifier)
          : effectSchema(declaredRequestBody),
      requestMediaType =
        operationIdentifier === "ingestAsset" ? "multipart/form-data" : "application/json",
      responseMediaType =
        operationDescriptor.schemas?.responseMediaType ??
        (operationIdentifier === "readAsset" || operationIdentifier === "inspectAssetContent"
          ? "application/octet-stream"
          : "application/json"),
      responseSchema =
        operationDescriptor.schemas === undefined
          ? (successSchemas.get(operationIdentifier) ?? {
              $ref: "#/components/schemas/JsonObject",
            })
          : responseMediaType === "application/octet-stream"
            ? { format: "binary", type: "string" }
            : effectSchema(operationDescriptor.schemas.response);
    return {
      operationId: operationIdentifier,
      ...(parameters.length === 0 ? {} : { parameters }),
      ...(requestBodySchema === undefined
        ? {}
        : {
            requestBody: {
              content: { [requestMediaType]: { schema: requestBodySchema } },
              required: true,
            },
          }),
      responses: {
        [String(successStatus)]: {
          description: bodyless
            ? "Operation completed without a response body"
            : "Successful response",
          ...(bodyless ? {} : { content: { [responseMediaType]: { schema: responseSchema } } }),
        },
        ...errorResponses(),
      },
    };
  },
  completePaths = (
    paths: Readonly<Record<string, Readonly<Record<string, OperationDescriptor>>>>,
  ): Readonly<Record<string, Readonly<Record<string, unknown>>>> =>
    Object.fromEntries(
      Object.entries(paths).map(([path, methods]) => [
        path,
        Object.fromEntries(
          Object.entries(methods).map(([method, operationDescriptor]) => [
            method,
            completeOperation(path, method, operationDescriptor),
          ]),
        ),
      ]),
    ),
  descriptor = (operationIdentifier: string): OperationDescriptor => ({ operationIdentifier }),
  customDescriptor = (operation: DeliveryOperation | ManagementOperation): OperationDescriptor => ({
    operationIdentifier: operation.identifier,
    schemas: operation.schemas,
    ...("successStatus" in operation && operation.successStatus !== undefined
      ? { successStatus: operation.successStatus }
      : {}),
  });

/** Builds the complete generic plus Builder-defined Management OpenAPI document. */
export const management = (operations: readonly ManagementOperation[] = []): Document => ({
  components: { schemas },
  info: { title: "Nearly Headless CMS Management API", version: "1.0.0" },
  openapi: "3.1.0",
  paths: completePaths({
    [`${managementPrefix}/definition-spaces/{definitionSpaceId}/content-types/{contentTypeId}/entries`]:
      { post: descriptor("createEntry") },
    [`${managementPrefix}/definition-spaces/{definitionSpaceId}/content-types/{contentTypeId}/entries/{entryId}`]:
      {
        delete: descriptor("deleteEntry"),
        get: descriptor("getEntry"),
        put: descriptor("replaceEntry"),
      },
    [`${managementPrefix}/definition-spaces/{definitionSpaceId}/content-types/{contentTypeId}/entries/{entryId}/read`]:
      { post: descriptor("readEntry") },
    [`${managementPrefix}/definition-spaces/{definitionSpaceId}/content-types/{contentTypeId}/entries/query`]:
      { post: descriptor("queryEntries") },
    [`${managementPrefix}/definition-spaces/{definitionSpaceId}/content-types/{contentTypeId}/entries/{entryId}/state`]:
      { get: descriptor("getCurrentEntryState") },
    [`${managementPrefix}/definition-spaces/{definitionSpaceId}/content-types/{contentTypeId}/entries/{entryId}/revisions`]:
      { get: descriptor("listEntryRevisions") },
    [`${managementPrefix}/definition-spaces/{definitionSpaceId}/content-types/{contentTypeId}/entries/{entryId}/revisions/{revisionNumber}`]:
      { get: descriptor("inspectEntryRevision") },
    [`${managementPrefix}/definition-spaces/{definitionSpaceId}/content-types/{contentTypeId}/entries/{entryId}/restorations`]:
      { post: descriptor("restoreEntryRevision") },
    [`${managementPrefix}/definition-spaces/{definitionSpaceId}/content-types/{contentTypeId}/entries/{entryId}/purges`]:
      { post: descriptor("permanentlyPurgeEntry") },
    [`${managementPrefix}/definition-spaces/{definitionSpaceId}/assets`]: {
      post: descriptor("ingestAsset"),
    },
    [`${managementPrefix}/definition-spaces/{definitionSpaceId}/assets/{assetId}`]: {
      delete: descriptor("deleteAsset"),
      get: descriptor("getAsset"),
    },
    [`${managementPrefix}/definition-spaces/{definitionSpaceId}/assets/{assetId}/content`]: {
      get: descriptor("readAsset"),
      head: descriptor("inspectAssetContent"),
    },
    [`${managementPrefix}/definition-spaces/{definitionSpaceId}/definitions`]: {
      get: descriptor("listDefinitions"),
    },
    [`${managementPrefix}/definition-spaces/{definitionSpaceId}/definitions/{definitionId}`]: {
      get: descriptor("getDefinition"),
    },
    [`${managementPrefix}/definition-spaces/{definitionSpaceId}/definitions/{definitionId}/revisions`]:
      {
        get: descriptor("listDefinitionRevisions"),
        post: descriptor("appendDefinitionRevision"),
      },
    [`${managementPrefix}/definition-spaces/{definitionSpaceId}/definitions/{definitionId}/retirements`]:
      { post: descriptor("retireDefinition") },
    [`${managementPrefix}/definition-spaces/{definitionSpaceId}/definition-snapshot`]: {
      get: descriptor("getActiveDefinitionSnapshot"),
    },
    [`${managementPrefix}/definition-spaces/{definitionSpaceId}/definition-snapshots`]: {
      get: descriptor("listDefinitionSnapshots"),
    },
    [`${managementPrefix}/definition-spaces/{definitionSpaceId}/definition-snapshots/{snapshotId}`]:
      { get: descriptor("inspectDefinitionSnapshot") },
    [`${managementPrefix}/definition-spaces/{definitionSpaceId}/definition-snapshot-activations`]: {
      post: descriptor("activateDefinitionSnapshot"),
    },
    [`${managementPrefix}/definition-spaces/{definitionSpaceId}/catalog-events`]: {
      get: descriptor("listCatalogEvents"),
    },
    [`${managementPrefix}/definition-spaces/{definitionSpaceId}/migration-manifests`]: {
      get: descriptor("listMigrationManifests"),
      post: descriptor("appendMigrationManifest"),
    },
    [`${managementPrefix}/definition-spaces/{definitionSpaceId}/migration-manifests/{migrationManifestId}`]:
      { get: descriptor("inspectMigrationManifest") },
    [`${managementPrefix}/definition-spaces/{definitionSpaceId}/migration-preparations/{migrationPreparationId}`]:
      { get: descriptor("inspectMigrationPreparation") },
    [`${managementPrefix}/definition-spaces/{definitionSpaceId}/migration-preparations`]: {
      post: descriptor("prepareDefinitionMigration"),
    },
    ...Object.fromEntries(
      operations.map((operation) => [
        `${managementPrefix}/definition-spaces/{definitionSpaceId}${operation.path}`,
        { [operation.method.toLowerCase()]: customDescriptor(operation) },
      ]),
    ),
  }),
});

/** Builds an OpenAPI document containing only declared Headless Delivery Operations. */
export const headless = (operations: readonly DeliveryOperation[]): Document => ({
  components: { schemas },
  info: { title: "Nearly Headless CMS Headless API", version: "1.0.0" },
  openapi: "3.1.0",
  paths: completePaths(
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
  ),
});

const sortedEntries = (value: object): readonly (readonly [string, unknown])[] =>
    Object.entries(value).sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey)),
  sortValue = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map(sortValue);
    }
    if (value === null || typeof value !== "object") {
      return value;
    }
    return Object.fromEntries(sortedEntries(value).map(([key, child]) => [key, sortValue(child)]));
  };

/** Serializes an OpenAPI document with deterministic recursively sorted object keys. */
export const stringify = (document: Document): string =>
  `${JSON.stringify(sortValue(document), null, 2)}\n`;
