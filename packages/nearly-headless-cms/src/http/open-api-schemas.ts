import { httpStatusNoContent } from "./http-status-codes.ts";

const additionalBodylessSuccessStatuses = new Map<string, readonly number[]>([
    ["deleteEntry", [httpStatusNoContent]],
  ]),
  createdStatus = 201,
  entrySchema = {
    properties: {
      contentTypeId: { type: "string" },
      id: { type: "string" },
      values: { additionalProperties: true, type: "object" },
    },
    required: ["contentTypeId", "id", "values"],
    type: "object",
  },
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
  firstIndex = 0,
  indentationSpaces = 2,
  noContentStatus = 204,
  okStatus = 200,
  paginatedOperations = new Set([
    "listEntryRevisions",
    "listDefinitions",
    "listDefinitionRevisions",
    "listDefinitionSnapshots",
    "listCatalogEvents",
    "listMigrationManifests",
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
  writeTokenHeaderOperations = new Set(["replaceEntry", "deleteEntry"]);

export default {
  additionalBodylessSuccessStatuses,
  createdStatus,
  firstIndex,
  indentationSpaces,
  noContentStatus,
  okStatus,
  paginatedOperations,
  requestBodySchemas,
  schemas,
  successSchemas,
  successStatuses,
  writeTokenHeaderOperations,
};
