import { type Cms, type CmsError } from "nearly-headless-cms";
import { Effect } from "effect";
import type { HttpContract } from "nearly-headless-cms/http";
import managementSupport from "./management-support.ts";

const { queryAllEntries, requireDeletionRecord, requiredParameter, requiredWriteToken } =
    managementSupport,
  buildCommentDeletionMutations = (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-218] batch mutations are built from mutable entry write tokens.
    commentStates: Readonly<readonly { entry: { id: string }; writeToken: string }[]>,
  ): Cms.EntryBatchMutation[] =>
    commentStates.map(
      (state): Cms.EntryBatchMutation => ({
        input: {
          contentTypeId: "comment",
          entryId: state.entry.id,
          writeToken: state.writeToken,
        },
        kind: "delete",
      }),
    ),
  buildPostDeletionMutations = (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-218] batch mutations are built from mutable entry write tokens.
    postStates: Readonly<readonly { entry: { id: string }; writeToken: string }[]>,
  ): Cms.EntryBatchMutation[] =>
    postStates.map(
      (state): Cms.EntryBatchMutation => ({
        input: {
          contentTypeId: "post",
          entryId: state.entry.id,
          writeToken: state.writeToken,
        },
        kind: "delete",
      }),
    ),
  deleteAuthorWithPostsAndComments: HttpContract.ManagementOperation["execute"] = ({
    cms,
    parameters,
    request,
  }) =>
    Effect.gen(function* deleteAuthorAndOwnedContent() {
      const authorId = requiredParameter(parameters, "entryId"),
        authorWriteToken = yield* requiredWriteToken(request),
        { commentStates, postStates } = yield* loadAuthorOwnedContentStates(cms, authorId),
        deletionRecord = yield* requireDeletionRecord(
          (yield* cms.mutateEntriesAtomically([
            ...buildCommentDeletionMutations(commentStates),
            ...buildPostDeletionMutations(postStates),
            {
              input: { contentTypeId: "author", entryId: authorId, writeToken: authorWriteToken },
              kind: "delete",
            },
          ])).at(-1),
        );
      return {
        deletedAuthorId: authorId,
        deletedCommentCount: commentStates.length,
        deletedPostCount: postStates.length,
        deletionRecord,
      };
    }),
  deletePostWithComments: HttpContract.ManagementOperation["execute"] = ({
    cms,
    parameters,
    request,
  }) =>
    Effect.gen(function* deletePostAndComments() {
      const commentStates = yield* loadCommentStatesForPost(
          cms,
          requiredParameter(parameters, "entryId"),
        ),
        deletionRecord = yield* requireDeletionRecord(
          (yield* cms.mutateEntriesAtomically([
            ...buildCommentDeletionMutations(commentStates),
            {
              input: {
                contentTypeId: "post",
                entryId: requiredParameter(parameters, "entryId"),
                writeToken: yield* requiredWriteToken(request),
              },
              kind: "delete",
            } satisfies Cms.EntryBatchMutation,
          ])).at(-1),
        ),
        postId = requiredParameter(parameters, "entryId");
      return { deletedCommentCount: commentStates.length, deletedPostId: postId, deletionRecord };
    }),
  loadAuthorOwnedContentStates = (
    cms: Readonly<Cms.ServiceShape>,
    authorId: string,
  ): Effect.Effect<
    {
      readonly commentStates: readonly { entry: { id: string }; writeToken: string }[];
      readonly postStates: readonly { entry: { id: string }; writeToken: string }[];
    },
    CmsError.CmsError
  > =>
    Effect.gen(function* loadAuthorOwnedContentEntryStates() {
      const commentGroups = yield* Effect.all(
          (yield* queryAllEntries(cms, {
            contentTypeId: "post",
            pageSize: 100,
            where: { operator: "equals", path: "author", value: authorId },
          })).map((post) =>
            queryAllEntries(cms, {
              contentTypeId: "comment",
              pageSize: 100,
              where: { operator: "equals", path: "post", value: post.id },
            }),
          ),
        ),
        commentStates = yield* Effect.all(
          commentGroups
            .flat()
            .map((comment) =>
              cms.getCurrentEntryState({ contentTypeId: "comment", entryId: comment.id }),
            ),
        ),
        postStates = yield* Effect.all(
          (yield* queryAllEntries(cms, {
            contentTypeId: "post",
            pageSize: 100,
            where: { operator: "equals", path: "author", value: authorId },
          })).map((post) => cms.getCurrentEntryState({ contentTypeId: "post", entryId: post.id })),
        );
      return { commentStates, postStates };
    }),
  loadCommentStatesForPost = (
    cms: Readonly<Cms.ServiceShape>,
    postId: string,
  ): Effect.Effect<readonly { entry: { id: string }; writeToken: string }[], CmsError.CmsError> =>
    Effect.gen(function* loadCommentStatesForPostEntries() {
      const comments = yield* cms.queryEntries({
        contentTypeId: "comment",
        pageSize: 100,
        where: { operator: "equals", path: "post", value: postId },
      });
      return yield* Effect.all(
        comments.items.map((comment) =>
          cms.getCurrentEntryState({ contentTypeId: "comment", entryId: comment.id }),
        ),
      );
    });

export default {
  deleteAuthorWithPostsAndComments,
  deletePostWithComments,
};
