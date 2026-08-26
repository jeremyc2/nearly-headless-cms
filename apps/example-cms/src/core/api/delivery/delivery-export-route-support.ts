import type { Cms } from "nearly-headless-cms";
import { publicExportArtifact, publicExportDeliveryQuery, type HttpContract } from "nearly-headless-cms/http";
import { Effect } from "effect";
import {
  authorDefinitionRequirement,
  commentDefinitionRequirement,
  guideDefinitionRequirement,
  postDefinitionRequirement,
  taxonomyDefinitionRequirement,
} from "./delivery-definition-requirements.ts";
import deliveryPublicContent from "./delivery-public-content-support.ts";
import { MAX_PUBLIC_EXPORT_BYTES, publicEntryValueOptions } from "./delivery-support.ts";
import { EmptyRequest, PublicBlogExport } from "../shared/wire-schemas.ts";

const { publicAssetIds, publicContent } = deliveryPublicContent,
  buildExportArtifact = (consistentSnapshot: Cms.ConsistentReadSnapshot) => {
    const content = publicContent(consistentSnapshot);
    return publicExportArtifact({
      assets: consistentSnapshot.assets.filter((asset) =>
        publicAssetIds(content.posts, content.authors).has(asset.id),
      ),
      content: {
        authors: content.authors,
        categories: content.categories,
        comments: content.comments,
        guides: content.guides,
        posts: content.posts,
        tags: content.tags,
      },
      definitionFingerprint: consistentSnapshot.definitionSnapshot.fingerprint,
      generatedAt: `${consistentSnapshot.definitionSnapshot.fingerprint}@${consistentSnapshot.generation}`,
      publicEntryValueOptions,
    });
  },
  createExportRoute = (): HttpContract.DeliveryOperation =>
    publicExportDeliveryQuery({
      buildArtifact: (consistentSnapshot) =>
        Effect.succeed(buildExportArtifact(consistentSnapshot)),
      definitionRequirements: [
        postDefinitionRequirement,
        authorDefinitionRequirement,
        taxonomyDefinitionRequirement("category"),
        taxonomyDefinitionRequirement("tag"),
        commentDefinitionRequirement,
        guideDefinitionRequirement,
      ],
      identifier: "exportPublicBlog",
      maximumBytes: MAX_PUBLIC_EXPORT_BYTES,
      reachableContentTypeIds: ["post", "author", "category", "tag", "comment", "guide"],
      request: EmptyRequest,
      response: PublicBlogExport,
    });

export default { buildExportRoute: createExportRoute };
