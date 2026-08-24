import { type Cms, CmsError } from "nearly-headless-cms";
import { Effect } from "effect";
import {
  authorDefinitionRequirement,
  taxonomyDefinitionRequirement,
} from "./delivery-definition-requirements.ts";
import deliveryPublicContent from "./delivery-public-content.ts";
import deliverySupport from "./delivery-support.ts";
import { PublicAuthor, PublicTaxonomy } from "./wire-schemas.ts";

const { publicContent } = deliveryPublicContent,
  { publicValue } = deliverySupport,
  publicOwnerBySlug = (
    cms: Cms.ServiceShape,
    contentTypeId: "author" | "category" | "tag",
    slug: string,
  ) =>
    cms.readConsistentSnapshot.pipe(
      Effect.flatMap((consistentSnapshot) => {
        const content = publicContent(consistentSnapshot);
        let entries = content.tags;
        if (contentTypeId === "author") {
          entries = content.authors;
        } else if (contentTypeId === "category") {
          entries = content.categories;
        }
        const entry = entries.find((candidate) => candidate.values["slug"] === slug);
        if (entry === undefined) {
          return Effect.fail(CmsError.NotFound.make({ message: `${contentTypeId} was not found` }));
        }
        return Effect.succeed(publicValue(entry));
      }),
    ),
  publicOwnerDefinition = (contentTypeId: "author" | "category" | "tag") => {
    if (contentTypeId === "author") {
      return authorDefinitionRequirement;
    }
    return taxonomyDefinitionRequirement(contentTypeId);
  },
  publicOwnerPath = (contentTypeId: "author" | "category" | "tag"): string => {
    if (contentTypeId === "category") {
      return "categories";
    }
    return `${contentTypeId}s`;
  },
  publicOwnerSchema = (contentTypeId: "author" | "category" | "tag") => {
    if (contentTypeId === "author") {
      return PublicAuthor;
    }
    return PublicTaxonomy;
  },
  publicRelationshipPath = (contentTypeId: "author" | "category" | "tag"): string => {
    if (contentTypeId === "author") {
      return "author";
    }
    if (contentTypeId === "category") {
      return "categories";
    }
    return "tags";
  };

export default {
  publicOwnerBySlug,
  publicOwnerDefinition,
  publicOwnerPath,
  publicOwnerSchema,
  publicRelationshipPath,
};
