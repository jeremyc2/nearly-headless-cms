import { CmsError } from "nearly-headless-cms";
import type { HttpContract } from "nearly-headless-cms/http";
import { Effect } from "effect";
import type { CommandReceiptStore } from "./command-receipt-store.ts";
import deliveryCommentSubmission from "./delivery-comment-submission.ts";
import {
  authorDefinitionRequirement,
  commentDefinitionRequirement,
  postDefinitionRequirement,
  taxonomyDefinitionRequirement,
} from "./delivery-definition-requirements.ts";
import deliveryExportRoute from "./delivery-export-route.ts";
import deliveryPublicAssetResponse from "./delivery-public-asset-response.ts";
import deliveryPublicContent from "./delivery-public-content.ts";
import deliveryPublicOwnerSupport from "./delivery-public-owner-support.ts";
import deliverySupport from "./delivery-support.ts";
import {
  AssetBytes,
  CommentReceipt,
  CommentSubmission,
  EmptyRequest,
  EntryPage,
  Identifier,
  PublicComment,
  PublicEntryReference,
  PublicPost,
} from "./wire-schemas.ts";

const { makeSubmitCommentExecute } = deliveryCommentSubmission,
  { buildExportRoute } = deliveryExportRoute,
  { publicAssetIds, publicContent } = deliveryPublicContent,
  { publicAssetResponse } = deliveryPublicAssetResponse,
  {
    publicOwnerBySlug,
    publicOwnerDefinition,
    publicOwnerPath,
    publicOwnerSchema,
    publicRelationshipPath,
  } = deliveryPublicOwnerSupport,
  { findBySlug, publicValue, queryPage, readSchemas, requiredParameter } = deliverySupport,
  assetDeliveryIdentifier = (method: "GET" | "HEAD"): string => {
    if (method === "GET") {
      return "deliverPublicAsset";
    }
    return "inspectPublicAsset";
  },
  buildAssetRoutes = (): readonly HttpContract.DeliveryOperation[] =>
    (["GET", "HEAD"] as const).map(
      (method): HttpContract.DeliveryOperation => ({
        cacheControl: "public, max-age=31536000, immutable",
        definitionRequirements: [postDefinitionRequirement, authorDefinitionRequirement],
        execute: ({ cms, parameters, request, requestId, snapshot }) =>
          Effect.gen(function* deliverPublicAsset() {
            const assetIdentifier = requiredParameter(parameters, "assetId"),
              consistentSnapshot = yield* cms.readConsistentSnapshot,
              content = publicContent(consistentSnapshot);
            if (!publicAssetIds(content.posts, content.authors).has(assetIdentifier)) {
              return yield* CmsError.NotFound.make({ message: "Public Asset was not found" });
            }
            const asset = yield* cms.readAsset(assetIdentifier);
            return publicAssetResponse({
              asset,
              definitionFingerprint: snapshot.fingerprint,
              request,
              requestId,
            });
          }),
        identifier: assetDeliveryIdentifier(method),
        method,
        path: "/assets/{assetId}",
        reachableContentTypeIds: ["post", "author", "category", "tag"],
        schemas: {
          pathParameters: { assetId: Identifier },
          request: EmptyRequest,
          response: AssetBytes,
          responseMediaType: "application/octet-stream",
        },
      }),
    ),
  buildCommentRoutes = (
    submitComment: HttpContract.DeliveryOperation["execute"],
  ): readonly HttpContract.DeliveryOperation[] => [
    {
      definitionRequirements: [postDefinitionRequirement, commentDefinitionRequirement],
      execute: ({ cms, parameters, request }) =>
        Effect.gen(function* listApprovedComments() {
          const post = yield* cms.getEntry({
            contentTypeId: "post",
            entryId: requiredParameter(parameters, "postId"),
          });
          if (post.values["status"] !== "published") {
            return yield* CmsError.NotFound.make({ message: "Published Post was not found" });
          }
          return yield* queryPage({
            cms,
            contentTypeId: "comment",
            request,
            sort: [{ direction: "ascending", path: "created-at" }],
            where: {
              all: [
                { operator: "equals", path: "post", value: post.id },
                { operator: "equals", path: "status", value: "approved" },
              ],
            },
          });
        }),
      identifier: "listApprovedComments",
      method: "GET",
      path: "/posts/{postId}/comments",
      reachableContentTypeIds: ["post", "comment"],
      schemas: readSchemas(EntryPage(PublicComment), { postId: Identifier }, true),
    },
    {
      definitionRequirements: [postDefinitionRequirement, commentDefinitionRequirement],
      execute: submitComment,
      identifier: "submitComment",
      method: "POST",
      path: "/posts/{postId}/comments",
      reachableContentTypeIds: ["post", "comment"],
      requiresIdempotencyKey: true,
      schemas: {
        pathParameters: { postId: Identifier },
        request: CommentSubmission,
        requestBody: CommentSubmission,
        requestHeaders: { "idempotency-key": Identifier },
        response: CommentReceipt,
      },
      successStatus: 201,
    },
  ],
  buildOwnerRoutes = (
    contentTypeId: "author" | "category" | "tag",
  ): readonly HttpContract.DeliveryOperation[] => [
    {
      definitionRequirements: [publicOwnerDefinition(contentTypeId), postDefinitionRequirement],
      execute: ({ cms, parameters }) =>
        publicOwnerBySlug(cms, contentTypeId, requiredParameter(parameters, "slug")),
      identifier: `getPublic${contentTypeId.slice(0, 1).toUpperCase()}${contentTypeId.slice(1)}BySlug`,
      method: "GET",
      path: `/${publicOwnerPath(contentTypeId)}/{slug}`,
      reachableContentTypeIds: [contentTypeId, "post"],
      schemas: readSchemas(publicOwnerSchema(contentTypeId), {
        slug: Identifier,
      }),
    },
    {
      definitionRequirements: [publicOwnerDefinition(contentTypeId), postDefinitionRequirement],
      execute: ({ cms, parameters, request }) =>
        Effect.gen(function* listOwnerPosts() {
          const owner = yield* publicOwnerBySlug(
              cms,
              contentTypeId,
              requiredParameter(parameters, "slug"),
            ),
            ownerIdentifier = owner["id"];
          if (typeof ownerIdentifier !== "string") {
            return yield* CmsError.InvalidInput.make({
              message: `Public ${contentTypeId} has an invalid identifier`,
            });
          }
          return yield* queryPage({
            cms,
            contentTypeId: "post",
            request,
            sort: [{ direction: "descending", path: "published-at" }],
            where: {
              all: [
                { operator: "equals", path: "status", value: "published" },
                {
                  operator: "equals",
                  path: publicRelationshipPath(contentTypeId),
                  value: ownerIdentifier,
                },
              ],
            },
          });
        }),
      identifier: `list${contentTypeId.slice(0, 1).toUpperCase()}${contentTypeId.slice(1)}Posts`,
      method: "GET",
      path: `/${publicOwnerPath(contentTypeId)}/{slug}/posts`,
      reachableContentTypeIds: [contentTypeId, "post"],
      schemas: readSchemas(EntryPage(PublicPost), { slug: Identifier }, true),
    },
  ],
  buildPostRoutes = (): readonly HttpContract.DeliveryOperation[] => {
    const sharedPostReachabilityRequirements = [
      postDefinitionRequirement,
      authorDefinitionRequirement,
      taxonomyDefinitionRequirement("category"),
      taxonomyDefinitionRequirement("tag"),
    ] as const;
    return [
      {
        definitionRequirements: [...sharedPostReachabilityRequirements],
        execute: ({ cms, request }) =>
          queryPage({
            cms,
            contentTypeId: "post",
            request,
            sort: [{ direction: "descending", path: "published-at" }],
            where: { operator: "equals", path: "status", value: "published" },
          }),
        identifier: "listPublishedPosts",
        method: "GET",
        path: "/posts",
        reachableContentTypeIds: ["post", "author", "category", "tag"],
        schemas: readSchemas(EntryPage(PublicPost), {}, true),
      },
      {
        definitionRequirements: [...sharedPostReachabilityRequirements],
        execute: ({ cms, parameters }) =>
          findBySlug({
            cms,
            contentTypeId: "post",
            publicOnly: true,
            slug: requiredParameter(parameters, "slug"),
          }),
        identifier: "getPublishedPostBySlug",
        method: "GET",
        path: "/posts/{slug}",
        reachableContentTypeIds: ["post", "author", "category", "tag"],
        schemas: readSchemas(PublicPost, { slug: Identifier }),
      },
    ];
  },
  buildReferenceRoute = (): HttpContract.DeliveryOperation => ({
    definitionRequirements: [
      postDefinitionRequirement,
      authorDefinitionRequirement,
      taxonomyDefinitionRequirement("category"),
      taxonomyDefinitionRequirement("tag"),
    ],
    execute: ({ cms, parameters }) =>
      Effect.gen(function* resolvePublicEntryReference() {
        const consistentSnapshot = yield* cms.readConsistentSnapshot,
          content = publicContent(consistentSnapshot),
          entryIdentifier = requiredParameter(parameters, "entryId");
        if (content.reachability.richTextReachableIdentifiers.has(entryIdentifier)) {
          const entry = [
            ...content.posts,
            ...content.authors,
            ...content.categories,
            ...content.tags,
          ].find((candidate) => candidate.id === entryIdentifier);
          if (entry !== undefined) {
            return publicValue(entry);
          }
        }
        return yield* CmsError.NotFound.make({
          message: "Public Entry reference was not found",
        });
      }),
    identifier: "resolvePublicEntryReference",
    method: "GET",
    path: "/references/entries/{entryId}",
    reachableContentTypeIds: ["post", "author", "category", "tag"],
    schemas: readSchemas(PublicEntryReference, { entryId: Identifier }),
  }),
  buildTaxonomyOwnerRoutes = (): readonly HttpContract.DeliveryOperation[] =>
    (["author", "category", "tag"] as const).flatMap((contentTypeId) =>
      buildOwnerRoutes(contentTypeId),
    );

export const buildDeliveryOperationRoutes = (
  commandReceiptStore: CommandReceiptStore,
): readonly HttpContract.DeliveryOperation[] => {
  const submitComment = makeSubmitCommentExecute(commandReceiptStore);
  return [
    ...buildPostRoutes(),
    ...buildTaxonomyOwnerRoutes(),
    ...buildCommentRoutes(submitComment),
    buildReferenceRoute(),
    ...buildAssetRoutes(),
    buildExportRoute(),
  ];
};

export default {
  buildDeliveryOperationRoutes,
};
