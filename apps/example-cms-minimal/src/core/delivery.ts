import { Schema } from "effect";
import {
  definitionRequirementFromContentType,
  entryBySlugDeliveryQuery,
  paginatedDeliveryQuery,
  type HttpContract,
} from "nearly-headless-cms/http";
import { definitionSnapshot } from "./definitions.ts";

const EmptyRequest = Schema.Struct({}),
  Identifier = Schema.String,
  Note = Schema.Struct({
    body: Schema.String,
    id: Schema.String,
    slug: Schema.String,
    title: Schema.String,
  }),
  NotePage = Schema.Struct({
    items: Schema.Array(Note),
    nextCursor: Schema.optionalKey(Schema.String),
  }),
  PageQuery = {
    cursor: Schema.optionalKey(Schema.String),
    pageSize: Schema.optionalKey(Schema.Int),
  },
  noteDefinitionRequirement = definitionRequirementFromContentType(definitionSnapshot, "note", {
    projectableOnly: true,
  }),
  sharedSchemas = {
    pageQuery: PageQuery,
    request: EmptyRequest,
  },
  // oxlint-disable-next-line eslint/one-var -- [EH-307] delivery operation assembly stays separate from schema constants.
  makeDeliveryOperations = (): readonly HttpContract.DeliveryOperation[] => [
    paginatedDeliveryQuery({
      contentTypeId: "note",
      definitionRequirements: [noteDefinitionRequirement],
      identifier: "listNotes",
      path: "/notes",
      reachableContentTypeIds: ["note"],
      response: NotePage,
      sort: [{ direction: "ascending", path: "title" }],
      ...sharedSchemas,
    }),
    entryBySlugDeliveryQuery({
      contentTypeId: "note",
      definitionRequirements: [noteDefinitionRequirement],
      identifier: "getNoteBySlug",
      path: "/notes/{slug}",
      pathParameterSchema: Identifier,
      reachableContentTypeIds: ["note"],
      response: Note,
      ...sharedSchemas,
    }),
  ];

/** Headless Delivery Queries for the minimal notes demo. */
export { makeDeliveryOperations };
