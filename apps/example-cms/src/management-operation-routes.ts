import {
  AuthorCascadeDeletionReceipt,
  CascadeDeletionReceipt,
  DetachmentReceipt,
  EditorialReceipt,
  EmptyRequest,
  type HttpContract,
  Identifier,
  ImageDeletionReceipt,
  ImageReplacementReceipt,
  ImageReplacementRequest,
  PublicAsset,
  Schema,
  authorDefinitionRequirement,
  commentDefinitionRequirement,
  postDefinitionRequirement,
  taxonomyDefinitionRequirement,
} from "./management-operation-routes-imports.ts";

interface EditorialRouteInput {
  readonly contentTypeId: "post" | "comment";
  readonly definitionRequirements: HttpContract.ManagementOperation["definitionRequirements"];
  readonly identifier: string;
  readonly path: HttpContract.ManagementOperation["path"];
  readonly status: "draft" | "published" | "approved" | "rejected";
  readonly transition: ManagementRouteHandlers["transition"];
}

interface ManagementRouteHandlers {
  readonly deleteAuthorWithPostsAndComments: HttpContract.ManagementOperation["execute"];
  readonly deleteImageAndClearAssignments: HttpContract.ManagementOperation["execute"];
  readonly deletePostWithComments: HttpContract.ManagementOperation["execute"];
  readonly detachTaxonomy: (
    contentTypeId: "category" | "tag",
    relationshipField: "categories" | "tags",
  ) => HttpContract.ManagementOperation["execute"];
  readonly listExampleAssets: HttpContract.ManagementOperation["execute"];
  readonly replaceImage: HttpContract.ManagementOperation["execute"];
  readonly transition: (
    contentTypeId: "post" | "comment",
    status: "draft" | "published" | "approved" | "rejected",
  ) => HttpContract.ManagementOperation["execute"];
}

const buildAssetRoutes = (
    handlers: Pick<
      ManagementRouteHandlers,
      "deleteImageAndClearAssignments" | "listExampleAssets" | "replaceImage"
    >,
  ): readonly HttpContract.ManagementOperation[] => [
    {
      definitionRequirements: [],
      execute: handlers.listExampleAssets,
      identifier: "listExampleAssets",
      method: "GET",
      path: "/operations/assets",
      schemas: {
        request: EmptyRequest,
        response: Schema.Array(PublicAsset),
      },
    },
    {
      definitionRequirements: [postDefinitionRequirement, authorDefinitionRequirement],
      execute: handlers.deleteImageAndClearAssignments,
      identifier: "deleteImageAndClearAssignments",
      method: "POST",
      path: "/operations/assets/{assetId}/assignment-clearing-deletions",
      schemas: {
        pathParameters: { assetId: Identifier },
        request: EmptyRequest,
        requestHeaders: { "idempotency-key": Identifier },
        response: ImageDeletionReceipt,
      },
    },
    {
      definitionRequirements: [postDefinitionRequirement, authorDefinitionRequirement],
      execute: handlers.replaceImage,
      identifier: "replaceImage",
      method: "POST",
      path: "/operations/assets/{assetId}/replacements",
      schemas: {
        pathParameters: { assetId: Identifier },
        request: ImageReplacementRequest,
        requestBody: ImageReplacementRequest,
        requestHeaders: { "idempotency-key": Identifier },
        requestMediaType: "multipart/form-data",
        response: ImageReplacementReceipt,
      },
    },
  ],
  buildCascadeDeletionRoutes = (
    handlers: Pick<
      ManagementRouteHandlers,
      "deleteAuthorWithPostsAndComments" | "deletePostWithComments" | "detachTaxonomy"
    >,
  ): readonly HttpContract.ManagementOperation[] => [
    ...buildContentCascadeRoutes(handlers),
    ...buildTaxonomyCascadeRoutes(handlers.detachTaxonomy),
  ],
  buildCommentEditorialRoutes = (
    transition: ManagementRouteHandlers["transition"],
  ): readonly HttpContract.ManagementOperation[] => [
    editorialRoute({
      contentTypeId: "comment",
      definitionRequirements: [commentDefinitionRequirement],
      identifier: "approveComment",
      path: "/operations/comments/{entryId}/approvals",
      status: "approved",
      transition,
    }),
    editorialRoute({
      contentTypeId: "comment",
      definitionRequirements: [commentDefinitionRequirement],
      identifier: "rejectComment",
      path: "/operations/comments/{entryId}/rejections",
      status: "rejected",
      transition,
    }),
  ],
  buildContentCascadeRoutes = (
    handlers: Pick<
      ManagementRouteHandlers,
      "deleteAuthorWithPostsAndComments" | "deletePostWithComments"
    >,
  ): readonly HttpContract.ManagementOperation[] => [
    {
      definitionRequirements: [postDefinitionRequirement, commentDefinitionRequirement],
      execute: handlers.deletePostWithComments,
      identifier: "deletePostWithComments",
      method: "POST",
      path: "/operations/posts/{entryId}/cascade-deletions",
      schemas: {
        pathParameters: { entryId: Identifier },
        request: EmptyRequest,
        requestHeaders: { "cms-write-token": Identifier },
        response: CascadeDeletionReceipt,
      },
    },
    {
      definitionRequirements: [
        authorDefinitionRequirement,
        postDefinitionRequirement,
        commentDefinitionRequirement,
      ],
      execute: handlers.deleteAuthorWithPostsAndComments,
      identifier: "deleteAuthorWithPostsAndComments",
      method: "POST",
      path: "/operations/authors/{entryId}/cascade-deletions",
      schemas: {
        pathParameters: { entryId: Identifier },
        request: EmptyRequest,
        requestHeaders: { "cms-write-token": Identifier },
        response: AuthorCascadeDeletionReceipt,
      },
    },
  ],
  buildEditorialRoutes = (
    transition: ManagementRouteHandlers["transition"],
  ): readonly HttpContract.ManagementOperation[] => [
    ...buildPostEditorialRoutes(transition),
    ...buildCommentEditorialRoutes(transition),
  ],
  buildManagementOperationRoutes = (
    handlers: ManagementRouteHandlers,
  ): readonly HttpContract.ManagementOperation[] => [
    ...buildEditorialRoutes(handlers.transition),
    ...buildCascadeDeletionRoutes(handlers),
    ...buildAssetRoutes(handlers),
  ],
  buildPostEditorialRoutes = (
    transition: ManagementRouteHandlers["transition"],
  ): readonly HttpContract.ManagementOperation[] => [
    editorialRoute({
      contentTypeId: "post",
      definitionRequirements: [
        postDefinitionRequirement,
        authorDefinitionRequirement,
        taxonomyDefinitionRequirement("category"),
        taxonomyDefinitionRequirement("tag"),
      ],
      identifier: "publishPost",
      path: "/operations/posts/{entryId}/publications",
      status: "published",
      transition,
    }),
    editorialRoute({
      contentTypeId: "post",
      definitionRequirements: [postDefinitionRequirement],
      identifier: "returnPostToDraft",
      path: "/operations/posts/{entryId}/draft-returns",
      status: "draft",
      transition,
    }),
  ],
  buildTaxonomyCascadeRoutes = (
    detachTaxonomy: ManagementRouteHandlers["detachTaxonomy"],
  ): readonly HttpContract.ManagementOperation[] => [
    {
      definitionRequirements: [taxonomyDefinitionRequirement("category"), postDefinitionRequirement],
      execute: detachTaxonomy("category", "categories"),
      identifier: "detachAndDeleteCategory",
      method: "POST",
      path: "/operations/categories/{entryId}/detachments",
      schemas: {
        pathParameters: { entryId: Identifier },
        request: EmptyRequest,
        requestHeaders: { "cms-write-token": Identifier },
        response: DetachmentReceipt,
      },
    },
    {
      definitionRequirements: [taxonomyDefinitionRequirement("tag"), postDefinitionRequirement],
      execute: detachTaxonomy("tag", "tags"),
      identifier: "detachAndDeleteTag",
      method: "POST",
      path: "/operations/tags/{entryId}/detachments",
      schemas: {
        pathParameters: { entryId: Identifier },
        request: EmptyRequest,
        requestHeaders: { "cms-write-token": Identifier },
        response: DetachmentReceipt,
      },
    },
  ],
  editorialRoute = ({
    contentTypeId,
    definitionRequirements,
    identifier,
    path,
    status,
    transition,
  }: EditorialRouteInput): HttpContract.ManagementOperation => ({
    definitionRequirements,
    execute: transition(contentTypeId, status),
    identifier,
    method: "POST",
    path,
    schemas: {
      pathParameters: { entryId: Identifier },
      request: EmptyRequest,
      requestHeaders: { "cms-write-token": Identifier },
      response: EditorialReceipt,
    },
  });

export default {
  buildManagementOperationRoutes,
};
