import {
  type DeliveryOperation,
  type ManagementOperation,
  headlessPrefix,
  managementPrefix,
} from "./HttpContract.ts";

export interface Document {
  readonly openapi: "3.1.0";
  readonly info: { readonly title: string; readonly version: "1.0.0" };
  readonly paths: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  readonly components: { readonly schemas: Readonly<Record<string, unknown>> };
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
            digest: { type: "string" },
            filename: { type: "string" },
            mediaType: { type: "string" },
          },
          required: ["filename", "mediaType", "byteLength", "digest"],
          type: "object",
        },
      },
      required: ["id", "metadata"],
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
  },
  successStatuses = new Map<string, string>([
    ["createEntry", "201"],
    ["ingestAsset", "201"],
    ["appendDefinitionRevision", "201"],
    ["retireDefinition", "201"],
    ["activateDefinitionSnapshot", "201"],
    ["appendMigrationManifest", "201"],
    ["deleteEntry", "204"],
    ["deleteAsset", "204"],
    ["permanentlyPurgeEntry", "204"],
  ]),
  pathParameters = (path: string): readonly Readonly<Record<string, unknown>>[] =>
    [...path.matchAll(/\{([^}]+)\}/gu)].map((match) => ({
      in: "path",
      name: match[1],
      required: true,
      schema: { type: match[1] === "revisionNumber" ? "integer" : "string" },
    })),
  completeOperation = (
    path: string,
    method: string,
    rawOperation: unknown,
  ): Readonly<Record<string, unknown>> => {
    const operation = rawOperation as Readonly<Record<string, unknown>>,
      operationIdentifier = String(operation["operationId"]),
      successStatus = successStatuses.get(operationIdentifier) ?? "200",
      bodyless = method === "head" || successStatus === "204",
      requestBody =
        method === "post" || method === "put"
          ? {
              content: {
                [operationIdentifier === "ingestAsset"
                  ? "multipart/form-data"
                  : "application/json"]: {
                  schema: { $ref: "#/components/schemas/JsonObject" },
                },
              },
              required: true,
            }
          : undefined;
    return {
      ...operation,
      ...(pathParameters(path).length === 0 ? {} : { parameters: pathParameters(path) }),
      ...(requestBody === undefined ? {} : { requestBody }),
      responses: {
        [successStatus]: {
          description: bodyless
            ? "Operation completed without a response body"
            : "Successful response",
          ...(bodyless
            ? {}
            : {
                content: {
                  "application/json": { schema: {} },
                },
              }),
        },
        default: {
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/Error" } },
          },
          description: "Declared API or transport failure",
        },
      },
    };
  },
  completePaths = (
    paths: Readonly<Record<string, Readonly<Record<string, unknown>>>>,
  ): Readonly<Record<string, Readonly<Record<string, unknown>>>> =>
    Object.fromEntries(
      Object.entries(paths).map(([path, methods]) => [
        path,
        Object.fromEntries(
          Object.entries(methods).map(([method, operation]) => [
            method,
            completeOperation(path, method, operation),
          ]),
        ),
      ]),
    );

export const management = (operations: readonly ManagementOperation[] = []): Document => ({
  components: { schemas },
  info: { title: "Nearly Headless CMS Management API", version: "1.0.0" },
  openapi: "3.1.0",
  paths: completePaths({
    [`${managementPrefix}/definition-spaces/{definitionSpaceId}/content-types/{contentTypeId}/entries`]:
      { post: { operationId: "createEntry" } },
    [`${managementPrefix}/definition-spaces/{definitionSpaceId}/content-types/{contentTypeId}/entries/{entryId}`]:
      {
        get: { operationId: "getEntry" },
        put: { operationId: "replaceEntry" },
        delete: { operationId: "deleteEntry" },
      },
    [`${managementPrefix}/definition-spaces/{definitionSpaceId}/content-types/{contentTypeId}/entries/{entryId}/read`]:
      { post: { operationId: "readEntry" } },
    [`${managementPrefix}/definition-spaces/{definitionSpaceId}/content-types/{contentTypeId}/entries/query`]:
      { post: { operationId: "queryEntries" } },
    [`${managementPrefix}/definition-spaces/{definitionSpaceId}/content-types/{contentTypeId}/entries/{entryId}/state`]:
      { get: { operationId: "getCurrentEntryState" } },
    [`${managementPrefix}/definition-spaces/{definitionSpaceId}/content-types/{contentTypeId}/entries/{entryId}/revisions`]:
      { get: { operationId: "listEntryRevisions" } },
    [`${managementPrefix}/definition-spaces/{definitionSpaceId}/content-types/{contentTypeId}/entries/{entryId}/revisions/{revisionNumber}`]:
      { get: { operationId: "inspectEntryRevision" } },
    [`${managementPrefix}/definition-spaces/{definitionSpaceId}/content-types/{contentTypeId}/entries/{entryId}/restorations`]:
      { post: { operationId: "restoreEntryRevision" } },
    [`${managementPrefix}/definition-spaces/{definitionSpaceId}/content-types/{contentTypeId}/entries/{entryId}/purges`]:
      { post: { operationId: "permanentlyPurgeEntry" } },
    [`${managementPrefix}/definition-spaces/{definitionSpaceId}/assets`]: {
      post: { operationId: "ingestAsset" },
    },
    [`${managementPrefix}/definition-spaces/{definitionSpaceId}/assets/{assetId}`]: {
      get: { operationId: "getAsset" },
      delete: { operationId: "deleteAsset" },
    },
    [`${managementPrefix}/definition-spaces/{definitionSpaceId}/assets/{assetId}/content`]: {
      get: { operationId: "readAsset" },
      head: { operationId: "inspectAssetContent" },
    },
    [`${managementPrefix}/definition-spaces/{definitionSpaceId}/definitions`]: {
      get: { operationId: "listDefinitions" },
    },
    [`${managementPrefix}/definition-spaces/{definitionSpaceId}/definitions/{definitionId}`]: {
      get: { operationId: "getDefinition" },
    },
    [`${managementPrefix}/definition-spaces/{definitionSpaceId}/definitions/{definitionId}/revisions`]:
      {
        get: { operationId: "listDefinitionRevisions" },
        post: { operationId: "appendDefinitionRevision" },
      },
    [`${managementPrefix}/definition-spaces/{definitionSpaceId}/definitions/{definitionId}/retirements`]:
      { post: { operationId: "retireDefinition" } },
    [`${managementPrefix}/definition-spaces/{definitionSpaceId}/definition-snapshot`]: {
      get: { operationId: "getActiveDefinitionSnapshot" },
    },
    [`${managementPrefix}/definition-spaces/{definitionSpaceId}/definition-snapshots`]: {
      get: { operationId: "listDefinitionSnapshots" },
    },
    [`${managementPrefix}/definition-spaces/{definitionSpaceId}/definition-snapshots/{snapshotId}`]:
      { get: { operationId: "inspectDefinitionSnapshot" } },
    [`${managementPrefix}/definition-spaces/{definitionSpaceId}/definition-snapshot-activations`]: {
      post: { operationId: "activateDefinitionSnapshot" },
    },
    [`${managementPrefix}/definition-spaces/{definitionSpaceId}/catalog-events`]: {
      get: { operationId: "listCatalogEvents" },
    },
    [`${managementPrefix}/definition-spaces/{definitionSpaceId}/migration-manifests`]: {
      get: { operationId: "listMigrationManifests" },
      post: { operationId: "appendMigrationManifest" },
    },
    [`${managementPrefix}/definition-spaces/{definitionSpaceId}/migration-manifests/{migrationManifestId}`]:
      { get: { operationId: "inspectMigrationManifest" } },
    [`${managementPrefix}/definition-spaces/{definitionSpaceId}/migration-preparations/{migrationPreparationId}`]:
      { get: { operationId: "inspectMigrationPreparation" } },
    [`${managementPrefix}/definition-spaces/{definitionSpaceId}/migration-preparations`]: {
      post: { operationId: "prepareDefinitionMigration" },
    },
    ...Object.fromEntries(
      operations.map((operation) => [
        `${managementPrefix}/definition-spaces/{definitionSpaceId}${operation.path}`,
        { [operation.method.toLowerCase()]: { operationId: operation.identifier } },
      ]),
    ),
  }),
});

export const headless = (operations: readonly DeliveryOperation[]): Document => ({
  components: { schemas },
  info: { title: "Nearly Headless CMS Headless API", version: "1.0.0" },
  openapi: "3.1.0",
  paths: completePaths(
    operations.reduce<Record<string, Record<string, unknown>>>(
      (paths, operation) => {
        const path = `${headlessPrefix}${operation.path}`;
        paths[path] = {
          ...paths[path],
          [operation.method.toLowerCase()]: { operationId: operation.identifier },
        };
        return paths;
      },
      {
        [`${headlessPrefix}/schema`]: { get: { operationId: "discoverPublicDefinitionSnapshot" } },
      },
    ),
  ),
});

const sortValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value === null || typeof value !== "object") {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortValue(child)]),
  );
};

export const stringify = (document: Document): string =>
  `${JSON.stringify(sortValue(document), null, 2)}\n`;
