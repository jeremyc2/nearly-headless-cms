import { type ManagementOperation, managementPrefix } from "./http-contract.ts";
import type { OperationDescriptor } from "./open-api-types.ts";
import openApiOperationSupport from "./open-api-operation-support.ts";

const { customDescriptor, descriptor } = openApiOperationSupport,
  aEntryManagementPaths = (): Readonly<
    Record<string, Readonly<Record<string, OperationDescriptor>>>
  > => ({
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
  }),
  bAssetManagementPaths = (): Readonly<
    Record<string, Readonly<Record<string, OperationDescriptor>>>
  > => ({
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
  }),
  cDefinitionManagementPaths = (): Readonly<
    Record<string, Readonly<Record<string, OperationDescriptor>>>
  > => ({
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
  }),
  dCustomManagementPaths = (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-194] OpenAPI operation descriptors are read while building path maps.
    operations: readonly ManagementOperation[],
  ): Readonly<Record<string, Readonly<Record<string, OperationDescriptor>>>> =>
    Object.fromEntries(
      operations.map((operation) => [
        `${managementPrefix}/definition-spaces/{definitionSpaceId}${operation.path}`,
        { [operation.method.toLowerCase()]: customDescriptor(operation) },
      ]),
    ),
  eManagementPaths = (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-194] OpenAPI operation descriptors are read while building path maps.
    operations: readonly ManagementOperation[],
  ): Readonly<Record<string, Readonly<Record<string, OperationDescriptor>>>> => ({
    ...aEntryManagementPaths(),
    ...bAssetManagementPaths(),
    ...cDefinitionManagementPaths(),
    ...dCustomManagementPaths(operations),
  });

export default { managementPaths: eManagementPaths };
