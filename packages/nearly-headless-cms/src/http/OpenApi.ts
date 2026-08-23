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
};

export const management = (operations: readonly ManagementOperation[] = []): Document => ({
  components: { schemas: { Error: errorSchema } },
  info: { title: "Nearly Headless CMS Management API", version: "1.0.0" },
  openapi: "3.1.0",
  paths: {
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
  },
});

export const headless = (operations: readonly DeliveryOperation[]): Document => ({
  components: { schemas: { Error: errorSchema } },
  info: { title: "Nearly Headless CMS Headless API", version: "1.0.0" },
  openapi: "3.1.0",
  paths: operations.reduce<Record<string, Record<string, unknown>>>(
    (paths, operation) => {
      const path = `${headlessPrefix}${operation.path}`;
      paths[path] = {
        ...paths[path],
        [operation.method.toLowerCase()]: { operationId: operation.identifier },
      };
      return paths;
    },
    { [`${headlessPrefix}/schema`]: { get: { operationId: "discoverPublicDefinitionSnapshot" } } },
  ),
});

export const stringify = (document: Document): string =>
  `${JSON.stringify(document, Object.keys(document).sort(), 2)}\n`;
