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

const createdStatus = 201,
  firstIndex = 0,
  indentationSpaces = 2,
  noContentStatus = 204,
  okStatus = 200,
  errorSchema = {
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
    DeletionRecord: {
      properties: {
        contentTypeId: { type: "string" },
        deletedAt: { format: "date-time", type: "string" },
        entryId: { type: "string" },
        latestRevisionNumber: { minimum: 1, type: "integer" },
        writeToken: { type: "string" },
      },
      required: ["entryId", "contentTypeId", "deletedAt", "latestRevisionNumber", "writeToken"],
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
    ["createEntry", createdStatus],
    ["ingestAsset", createdStatus],
    ["appendDefinitionRevision", createdStatus],
    ["retireDefinition", createdStatus],
    ["activateDefinitionSnapshot", createdStatus],
    ["appendMigrationManifest", createdStatus],
    ["deleteAsset", noContentStatus],
    ["permanentlyPurgeEntry", noContentStatus],
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
    ["deleteEntry", { $ref: "#/components/schemas/DeletionRecord" }],
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
  additionalBodylessSuccessStatuses = new Map<string, readonly number[]>([
    ["deleteEntry", [noContentStatus]],
  ]),
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
    if (Object.keys(document.definitions).length === firstIndex) {
      return document.schema;
    }
    return { ...document.schema, $defs: document.definitions };
  },
  conditionalValue = <Value>(condition: boolean, whenTrue: Value, whenFalse: Value): Value => {
    if (condition) {
      return whenTrue;
    }
    return whenFalse;
  },
  pathParameters = (
    path: string,
    operationSchemas?: OperationSchemas,
  ): readonly Readonly<Record<string, unknown>>[] =>
    [...path.matchAll(/\{(?<parameterName>[^}]+)\}/gu)].map((match) => {
      const parameterName = match.groups?.["parameterName"] ?? "",
        declaredSchema = operationSchemas?.pathParameters?.[parameterName];
      let parameterSchema: Readonly<Record<string, unknown>>;
      if (declaredSchema === undefined) {
        parameterSchema = { type: "string" };
        if (parameterName === "revisionNumber") {
          parameterSchema = { type: "integer" };
        }
      } else {
        parameterSchema = effectSchema(declaredSchema);
      }
      return {
        in: "path",
        name: parameterName,
        required: true,
        schema: parameterSchema,
      };
    }),
  queryParameters = (
    operationIdentifier: string,
    operationSchemas?: OperationSchemas,
  ): readonly Readonly<Record<string, unknown>>[] => {
    let declared = operationSchemas?.queryParameters;
    if (declared === undefined && paginatedOperations.has(operationIdentifier)) {
      declared = { cursor: Schema.String, pageSize: Schema.Int };
    }
    declared ??= {};
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
      ...operationSchemas?.requestHeaders,
    };
    if (writeTokenHeaderOperations.has(operationIdentifier)) {
      Object.assign(declared, { "CMS-Write-Token": Schema.String });
    }
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
    const { operationIdentifier } = operationDescriptor,
      successStatus =
        operationDescriptor.successStatus ?? successStatuses.get(operationIdentifier) ?? okStatus,
      bodyless = method === "head" || successStatus === noContentStatus,
      parameters = [
        ...pathParameters(path, operationDescriptor.schemas),
        ...queryParameters(operationIdentifier, operationDescriptor.schemas),
        ...headerParameters(operationIdentifier, operationDescriptor.schemas),
      ],
      declaredRequestBody = operationDescriptor.schemas?.requestBody,
      requestMediaType =
        operationDescriptor.schemas?.requestMediaType ??
        conditionalValue(
          operationIdentifier === "ingestAsset",
          "multipart/form-data",
          "application/json",
        ),
      responseMediaType =
        operationDescriptor.schemas?.responseMediaType ??
        conditionalValue(
          operationIdentifier === "readAsset" || operationIdentifier === "inspectAssetContent",
          "application/octet-stream",
          "application/json",
        );
    let requestBodySchema: Readonly<Record<string, unknown>> | undefined;
    if (declaredRequestBody === undefined) {
      requestBodySchema = requestBodySchemas.get(operationIdentifier);
    } else {
      requestBodySchema = effectSchema(declaredRequestBody);
    }
    let responseSchema: Readonly<Record<string, unknown>>;
    if (operationDescriptor.schemas === undefined) {
      responseSchema = successSchemas.get(operationIdentifier) ?? {
        $ref: "#/components/schemas/JsonObject",
      };
    } else if (responseMediaType === "application/octet-stream") {
      responseSchema = { format: "binary", type: "string" };
    } else {
      responseSchema = effectSchema(operationDescriptor.schemas.response);
    }
    let responseDescription = "Successful response";
    if (bodyless) {
      responseDescription = "Operation completed without a response body";
    }
    const operation: Record<string, unknown> = {
      operationId: operationIdentifier,
      ...conditionalValue(parameters.length === firstIndex, {}, { parameters }),
      responses: {
        [String(successStatus)]: {
          description: responseDescription,
          ...conditionalValue(
            bodyless,
            {},
            { content: { [responseMediaType]: { schema: responseSchema } } },
          ),
        },
        ...Object.fromEntries(
          (additionalBodylessSuccessStatuses.get(operationIdentifier) ?? []).map((status) => [
            String(status),
            { description: "Operation completed without a response body" },
          ]),
        ),
        ...errorResponses(),
      },
    };
    if (requestBodySchema !== undefined) {
      operation["requestBody"] = {
        content: { [requestMediaType]: { schema: requestBodySchema } },
        required: true,
      };
    }
    return operation;
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
  customDescriptor = (operation: DeliveryOperation | ManagementOperation): OperationDescriptor => {
    const operationDescriptor: OperationDescriptor = {
      operationIdentifier: operation.identifier,
      schemas: operation.schemas,
    };
    if ("successStatus" in operation && operation.successStatus !== undefined) {
      return { ...operationDescriptor, successStatus: operation.successStatus };
    }
    return operationDescriptor;
  };

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
    Object.entries(value).toSorted(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey)),
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
  `${JSON.stringify(sortValue(document), null, indentationSpaces)}\n`;
