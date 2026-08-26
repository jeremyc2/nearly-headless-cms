import { definitionRequirementFromContentType } from "nearly-headless-cms/http";
import { definitionSnapshot } from "../../content/definitions.ts";

/** Projectable Definition Requirements derived from the Example Blog CMS Snapshot. */
export const authorDefinitionRequirement = definitionRequirementFromContentType(
    definitionSnapshot,
    "author",
    { projectableOnly: true },
  ),
  postDefinitionRequirement = definitionRequirementFromContentType(
    definitionSnapshot,
    "post",
    { projectableOnly: true },
  ),
  taxonomyDefinitionRequirement = (contentTypeId: "category" | "tag") =>
    definitionRequirementFromContentType(definitionSnapshot, contentTypeId, {
      projectableOnly: true,
    });
