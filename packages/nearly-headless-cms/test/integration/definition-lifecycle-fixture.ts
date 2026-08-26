import {
  type CompiledSnapshot,
  type CustomFieldRegistration,
  compileSnapshot,
} from "../../src/content-definition.ts";
import { DevelopmentCms } from "../../src/testing/index.ts";
import type { HandlerInput } from "../../src/definition-migration.ts";
import { type Operation } from "../../src/index.ts";

const incompatibleNoteDefinition = {
    fields: [{ key: "title", kind: { kind: "integer" as const }, label: "Title", required: true }],
    history: true,
    id: "note",
    kind: "contentType" as const,
    name: "Note",
    parentRevision: 1,
    revision: 2,
  },
  initialSnapshot: CompiledSnapshot = compileSnapshot({
    definitionSpaceId: "definition-lifecycle",
    definitions: [
      {
        fields: [{ key: "title", kind: { kind: "text" }, label: "Title", required: true }],
        history: true,
        id: "note",
        kind: "contentType",
        name: "Note",
        revision: 1,
      },
    ],
    snapshotId: "initial",
  }),
  maxRatingValue = 5,
  noteSlugMigrationHandler = {
    identifier: "note-slug",
    transform: (input: Readonly<HandlerInput>) => ({ ...input.values, slug: "a-durable-note" }),
    version: 1,
  },
  noteSlugMigrationLayer = DevelopmentCms.layer({
    migrationHandlers: [noteSlugMigrationHandler],
    snapshot: initialSnapshot,
  }),
  noteSlugMigrationManifest = {
    handlerIdentifier: "note-slug",
    handlerVersion: 1,
    id: "add-note-slug",
    sourceSnapshotId: "optional-summary",
    targetSnapshotId: "required-slug",
  },
  operationContracts: readonly Operation.DefinitionContract[] = [
    {
      definitionRequirements: [
        {
          contentTypeId: "note",
          fields: [{ kind: "text", path: "title", projectable: true, required: true }],
        },
      ],
      identifier: "readPublicNote",
    },
  ],
  operationContractsLayer = DevelopmentCms.layer({ operationContracts, snapshot: initialSnapshot }),
  optionalSummaryDefinition = {
    fields: [
      { key: "title", kind: { kind: "text" as const }, label: "Title", required: true },
      { key: "summary", kind: { kind: "text" as const }, label: "Summary" },
    ],
    history: true,
    id: "note",
    kind: "contentType" as const,
    name: "Note",
    parentRevision: 1,
    revision: 2,
  },
  ratedNoteDefinition = {
    fields: [
      { key: "title", kind: { kind: "text" as const }, label: "Title", required: true },
      {
        key: "rating",
        kind: {
          configuration: {},
          formatVersion: 1,
          identifier: "com.example.rating",
          kind: "custom" as const,
        },
        label: "Rating",
      },
    ],
    history: true,
    id: "note",
    kind: "contentType" as const,
    name: "Note",
    parentRevision: 1,
    revision: 2,
  },
  ratedNoteRegistration: CustomFieldRegistration = {
    capabilities: { filter: ["equals"], projectable: true, sortable: true },
    formatVersion: 1,
    identifier: "com.example.rating",
    validateConfiguration: () => [],
    validateValue: (value) => {
      if (
        typeof value === "number" &&
        Number.isSafeInteger(value) &&
        value >= 1 &&
        value <= maxRatingValue
      ) {
        return [];
      }
      return [
        {
          message: "Rating must be an integer from one through five",
          path: [],
          reason: "invalidRating",
        },
      ];
    },
  },
  ratedNotesLayer = DevelopmentCms.layer({
    compileOptions: { customFieldKinds: [ratedNoteRegistration] },
    snapshot: initialSnapshot,
  }),
  requiredSlugDefinition = {
    ...optionalSummaryDefinition,
    fields: [
      ...optionalSummaryDefinition.fields,
      { key: "slug", kind: { kind: "text" as const }, label: "Slug", required: true, unique: true },
    ],
    parentRevision: 2,
    revision: 3,
  };

export {
  incompatibleNoteDefinition,
  initialSnapshot,
  noteSlugMigrationLayer,
  noteSlugMigrationManifest,
  noteSlugMigrationHandler,
  operationContractsLayer,
  optionalSummaryDefinition,
  ratedNoteDefinition,
  ratedNotesLayer,
  requiredSlugDefinition,
};
