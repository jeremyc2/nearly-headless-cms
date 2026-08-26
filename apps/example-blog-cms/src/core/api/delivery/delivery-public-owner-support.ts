import { type Cms, CmsError } from "nearly-headless-cms";
import { Effect } from "effect";
import {
  authorDefinitionRequirement,
  taxonomyDefinitionRequirement,
} from "./delivery-definition-requirements.ts";
import deliveryPublicContent from "./delivery-public-content-support.ts";
import deliverySupport from "./delivery-support.ts";
import { PublicAuthor, PublicTaxonomy } from "../shared/wire-schemas.ts";

const { publicContent } = deliveryPublicContent,
  { publicValue } = deliverySupport,
  publicOwnerBySlug = (
    cms: Readonly<Cms.ServiceShape>,
    contentTypeId: "author" | "category" | "tag",
    slug: string,
  ) =>
    cms.readConsistentSnapshot().pipe(
      Effect.flatMap((consistentSnapshot) => {
        const content = publicContent(consistentSnapshot),
          entries = publicOwnerEntries(content, contentTypeId),
          entry = entries.find((candidate) => candidate.values["slug"] === slug);
        if (entry === undefined) {
          return CmsError.NotFound.make({ message: `${contentTypeId} was not found` });
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
  publicOwnerEntries = <Content extends ReturnType<typeof publicContent>>(
    content: Readonly<Content>,
    contentTypeId: "author" | "category" | "tag",
  ) => {
    if (contentTypeId === "author") {
      return content.authors;
    }
    if (contentTypeId === "category") {
      return content.categories;
    }
    return content.tags;
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
