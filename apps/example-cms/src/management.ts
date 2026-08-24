import type { Cms, ContentDefinition } from "nearly-headless-cms";
import { CmsError } from "nearly-headless-cms";
import type { HttpContract } from "nearly-headless-cms/http";
import { Effect } from "effect";
import { type CommandReceiptStore, memoryCommandReceiptStore } from "./command-receipt-store.ts";
import {
  authorDefinitionRequirement,
  commentDefinitionRequirement,
  postDefinitionRequirement,
  taxonomyDefinitionRequirement,
} from "./delivery.ts";
import {
  CascadeDeletionReceipt,
  DetachmentReceipt,
  EditorialReceipt,
  EmptyRequest,
  Identifier,
  ImageReplacementReceipt,
  ImageReplacementRequest,
} from "./wire-schemas.ts";

const transition =
    (
      contentTypeId: "post" | "comment",
      status: "draft" | "published" | "approved" | "rejected",
    ): HttpContract.ManagementOperation["execute"] =>
    ({ cms, parameters, request }) =>
      Effect.gen(function* transition() {
        const entryId = parameters["entryId"]!,
          writeToken = request.headers.get("cms-write-token");
        if (writeToken === null || writeToken.length === 0) {
          return yield* CmsError.InvalidInput.make({ message: "CMS-Write-Token is required" });
        }
        const current = yield* cms.getEntry({ contentTypeId, entryId });
        return yield* cms.updateEntry({
          contentTypeId,
          entryId,
          values: {
            ...current.values,
            status,
            ...(contentTypeId === "post" &&
            status === "published" &&
            current.values["published-at"] == null
              ? { "published-at": new Date().toISOString() }
              : {}),
          },
          writeToken,
        });
      }),
  requiredWriteToken = (request: Request): Effect.Effect<string, CmsError.InvalidInput> => {
    const writeToken = request.headers.get("cms-write-token");
    return writeToken === null || writeToken.length === 0
      ? Effect.fail(CmsError.InvalidInput.make({ message: "CMS-Write-Token is required" }))
      : Effect.succeed(writeToken);
  },
  deletePostWithComments: HttpContract.ManagementOperation["execute"] = ({
    cms,
    parameters,
    request,
  }) =>
    Effect.gen(function* deletePostWithComments() {
      const postId = parameters["entryId"]!,
        postWriteToken = yield* requiredWriteToken(request),
        comments = yield* cms.queryEntries({
          contentTypeId: "comment",
          pageSize: 100,
          where: { operator: "equals", path: "post", value: postId },
        }),
        commentStates = yield* Effect.forEach(comments.items, (comment) =>
          cms.getCurrentEntryState({ contentTypeId: "comment", entryId: comment.id }),
        ),
        mutations: Cms.EntryBatchMutation[] = commentStates.map((state) => ({
          input: {
            contentTypeId: "comment",
            entryId: state.entry.id,
            writeToken: state.writeToken,
          },
          kind: "delete",
        }));
      mutations.push({
        input: { contentTypeId: "post", entryId: postId, writeToken: postWriteToken },
        kind: "delete",
      });
      yield* cms.mutateEntriesAtomically(mutations);
      return { deletedCommentCount: commentStates.length, deletedPostId: postId };
    }),
  detachTaxonomy =
    (
      contentTypeId: "category" | "tag",
      relationshipField: "categories" | "tags",
    ): HttpContract.ManagementOperation["execute"] =>
    ({ cms, parameters, request }) =>
      Effect.gen(function* detachTaxonomy() {
        const taxonomyEntryId = parameters["entryId"]!,
          taxonomyWriteToken = yield* requiredWriteToken(request),
          posts = yield* cms.queryEntries({
            contentTypeId: "post",
            pageSize: 100,
            where: { operator: "equals", path: relationshipField, value: taxonomyEntryId },
          }),
          postStates = yield* Effect.forEach(posts.items, (post) =>
            cms.getCurrentEntryState({ contentTypeId: "post", entryId: post.id }),
          ),
          mutations: Cms.EntryBatchMutation[] = postStates.map((state) => {
            const currentRelationships = state.entry.values[relationshipField],
              relationships = Array.isArray(currentRelationships)
                ? currentRelationships.filter((entryId) => entryId !== taxonomyEntryId)
                : [];
            return {
              input: {
                contentTypeId: "post",
                entryId: state.entry.id,
                values: { ...state.entry.values, [relationshipField]: relationships },
                writeToken: state.writeToken,
              },
              kind: "replace",
            };
          });
        mutations.push({
          input: { contentTypeId, entryId: taxonomyEntryId, writeToken: taxonomyWriteToken },
          kind: "delete",
        });
        yield* cms.mutateEntriesAtomically(mutations);
        return { detachedPostCount: postStates.length, removedEntryId: taxonomyEntryId };
      }),
  parseReplacementUpload = (request: Request) =>
    Effect.tryPromise({
      catch: () =>
        CmsError.InvalidInput.make({
          message: "Image replacement requires multipart metadata and content",
        }),
      try: async () => {
        const form = await request.formData(),
          metadataValue = form.get("metadata"),
          contentValue = form.get("content");
        if (typeof metadataValue !== "string" || !(contentValue instanceof File)) {
          throw new Error("invalid replacement upload");
        }
        const metadata = JSON.parse(metadataValue) as Readonly<Record<string, unknown>>;
        if (typeof metadata["filename"] !== "string" || typeof metadata["mediaType"] !== "string") {
          throw new Error("invalid replacement metadata");
        }
        return {
          content: new Uint8Array(await contentValue.arrayBuffer()),
          filename: metadata["filename"],
          mediaType: metadata["mediaType"],
          ...(typeof metadata["defaultAlternativeText"] === "string"
            ? { defaultAlternativeText: metadata["defaultAlternativeText"] }
            : {}),
          ...(typeof metadata["height"] === "number" ? { height: metadata["height"] } : {}),
          ...(typeof metadata["width"] === "number" ? { width: metadata["width"] } : {}),
        };
      },
    }),
  replaceRichTextAsset = (
    value: ContentDefinition.JsonValue,
    oldAssetId: string,
    newAssetId: string,
  ): ContentDefinition.JsonValue => {
    if (Array.isArray(value)) {
      return value.map((item) => replaceRichTextAsset(item, oldAssetId, newAssetId));
    }
    if (value === null || typeof value !== "object") {
      return value;
    }
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        key === "assetId" && child === oldAssetId
          ? newAssetId
          : replaceRichTextAsset(child, oldAssetId, newAssetId),
      ]),
    );
  },
  usesAsset = (
    values: ContentDefinition.JsonObject,
    directField: string,
    richTextField: string,
    assetId: string,
  ): boolean => {
    if (values[directField] === assetId) {
      return true;
    }
    const richText = values[richTextField];
    return richText !== undefined && JSON.stringify(richText).includes(`"assetId":"${assetId}"`);
  };

export interface ManagementOperationOptions {
  readonly commandReceiptStore?: CommandReceiptStore;
}

export const makeManagementOperations = (
  options: ManagementOperationOptions = {},
): readonly HttpContract.ManagementOperation[] => {
  const commandReceiptStore = options.commandReceiptStore ?? memoryCommandReceiptStore(),
    replaceImage: HttpContract.ManagementOperation["execute"] = ({ cms, parameters, request }) =>
      Effect.gen(function* replaceImage() {
        const oldAssetId = parameters["assetId"]!,
          commandKey = request.headers.get("idempotency-key");
        if (commandKey === null || commandKey.length === 0) {
          return yield* CmsError.InvalidInput.make({ message: "Idempotency-Key is required" });
        }
        const receiptScope = `image-replacement:${oldAssetId}`,
          prior = yield* Effect.tryPromise({
            catch: (cause) =>
              CmsError.InfrastructureFailure.make({
                cause,
                message: "Image replacement receipt lookup failed",
                retryable: true,
              }),
            try: () => commandReceiptStore.read(receiptScope, commandKey),
          });
        if (prior !== undefined) {
          return prior;
        }
        const upload = yield* parseReplacementUpload(request),
          newAsset = yield* cms.ingestAsset(upload),
          posts = yield* cms.queryEntries({ contentTypeId: "post", pageSize: 100 }),
          authors = yield* cms.queryEntries({ contentTypeId: "author", pageSize: 100 }),
          postStates = yield* Effect.forEach(
            posts.items.filter((post) =>
              usesAsset(post.values, "featured-asset", "body", oldAssetId),
            ),
            (post) => cms.getCurrentEntryState({ contentTypeId: "post", entryId: post.id }),
          ),
          authorStates = yield* Effect.forEach(
            authors.items.filter((author) =>
              usesAsset(author.values, "portrait", "profile", oldAssetId),
            ),
            (author) => cms.getCurrentEntryState({ contentTypeId: "author", entryId: author.id }),
          ),
          mutations: Cms.EntryBatchMutation[] = [
            ...postStates.map(
              (state): Cms.EntryBatchMutation => ({
                input: {
                  contentTypeId: "post",
                  entryId: state.entry.id,
                  values: {
                    ...state.entry.values,
                    body: replaceRichTextAsset(
                      state.entry.values["body"]!,
                      oldAssetId,
                      newAsset.id,
                    ),
                    ...(state.entry.values["featured-asset"] === oldAssetId
                      ? { "featured-asset": newAsset.id }
                      : {}),
                  },
                  writeToken: state.writeToken,
                },
                kind: "replace",
              }),
            ),
            ...authorStates.map(
              (state): Cms.EntryBatchMutation => ({
                input: {
                  contentTypeId: "author",
                  entryId: state.entry.id,
                  values: {
                    ...state.entry.values,
                    profile: replaceRichTextAsset(
                      state.entry.values["profile"]!,
                      oldAssetId,
                      newAsset.id,
                    ),
                    ...(state.entry.values["portrait"] === oldAssetId
                      ? { portrait: newAsset.id }
                      : {}),
                  },
                  writeToken: state.writeToken,
                },
                kind: "replace",
              }),
            ),
          ];
        if (mutations.length > 0) {
          yield* cms.mutateEntriesAtomically(mutations);
        }
        const oldAssetDeleted = yield* cms.deleteAsset(oldAssetId).pipe(
          Effect.as(true),
          Effect.catchTag("AssetReferenced", () => Effect.succeed(false)),
        );
        const receipt = {
          ingestionCompleted: true,
          newAssetId: newAsset.id,
          oldAssetDeleted,
          oldAssetId,
          reassignedEntryCount: mutations.length,
          reassignmentCompleted: true,
        };
        yield* Effect.tryPromise({
          catch: (cause) =>
            CmsError.InfrastructureFailure.make({
              cause,
              message: "Image replacement receipt persistence failed",
              retryable: true,
            }),
          try: () => commandReceiptStore.write(receiptScope, commandKey, receipt),
        });
        return receipt;
      });

  return [
    {
      definitionRequirements: [
        postDefinitionRequirement,
        authorDefinitionRequirement,
        taxonomyDefinitionRequirement("category"),
        taxonomyDefinitionRequirement("tag"),
      ],
      execute: transition("post", "published"),
      identifier: "publishPost",
      method: "POST",
      path: "/operations/posts/{entryId}/publications",
      schemas: {
        pathParameters: { entryId: Identifier },
        request: EmptyRequest,
        requestHeaders: { "cms-write-token": Identifier },
        response: EditorialReceipt,
      },
    },
    {
      definitionRequirements: [postDefinitionRequirement],
      execute: transition("post", "draft"),
      identifier: "returnPostToDraft",
      method: "POST",
      path: "/operations/posts/{entryId}/draft-returns",
      schemas: {
        pathParameters: { entryId: Identifier },
        request: EmptyRequest,
        requestHeaders: { "cms-write-token": Identifier },
        response: EditorialReceipt,
      },
    },
    {
      definitionRequirements: [commentDefinitionRequirement],
      execute: transition("comment", "approved"),
      identifier: "approveComment",
      method: "POST",
      path: "/operations/comments/{entryId}/approvals",
      schemas: {
        pathParameters: { entryId: Identifier },
        request: EmptyRequest,
        requestHeaders: { "cms-write-token": Identifier },
        response: EditorialReceipt,
      },
    },
    {
      definitionRequirements: [commentDefinitionRequirement],
      execute: transition("comment", "rejected"),
      identifier: "rejectComment",
      method: "POST",
      path: "/operations/comments/{entryId}/rejections",
      schemas: {
        pathParameters: { entryId: Identifier },
        request: EmptyRequest,
        requestHeaders: { "cms-write-token": Identifier },
        response: EditorialReceipt,
      },
    },
    {
      definitionRequirements: [postDefinitionRequirement, commentDefinitionRequirement],
      execute: deletePostWithComments,
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
        taxonomyDefinitionRequirement("category"),
        postDefinitionRequirement,
      ],
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
    {
      definitionRequirements: [postDefinitionRequirement, authorDefinitionRequirement],
      execute: replaceImage,
      identifier: "replaceImage",
      method: "POST",
      path: "/operations/assets/{assetId}/replacements",
      schemas: {
        pathParameters: { assetId: Identifier },
        request: ImageReplacementRequest,
        requestBody: ImageReplacementRequest,
        requestHeaders: { "idempotency-key": Identifier },
        response: ImageReplacementReceipt,
      },
    },
  ];
};
