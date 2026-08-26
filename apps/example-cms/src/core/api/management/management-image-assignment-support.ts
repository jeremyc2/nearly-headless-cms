import { type Cms, type CmsError, type ContentDefinition } from "nearly-headless-cms";
import { Effect } from "effect";
import managementImageUploadSupport from "./management-image-upload-support.ts";
import managementSupport from "./management-support.ts";

interface BuildImageReplacementMutationsInput {
  readonly authorStates: readonly {
    entry: { id: string; values: ContentDefinition.JsonObject };
    writeToken: string;
  }[];
  readonly newAssetId: string;
  readonly oldAssetId: string;
  readonly postStates: readonly {
    entry: { id: string; values: ContentDefinition.JsonObject };
    writeToken: string;
  }[];
}

interface EntryAssignmentState {
  readonly entry: { id: string; values: ContentDefinition.JsonObject };
  readonly writeToken: string;
}

const { conditionalProperty, queryAllEntries } = managementSupport,
  { replaceRichTextAsset, usesAsset } = managementImageUploadSupport,
  buildImageClearingMutations = (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-217] assignment states include mutable entry value maps.
    authorStates: Readonly<readonly EntryAssignmentState[]>,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-217] assignment states include mutable entry value maps.
    postStates: Readonly<readonly EntryAssignmentState[]>,
  ): Cms.EntryBatchMutation[] =>
    [
      ...postStates.map(
        (state): Cms.EntryBatchMutation => ({
          input: {
            contentTypeId: "post",
            entryId: state.entry.id,
            values: {
              ...state.entry.values,
              "featured-alternative-text": null,
              "featured-asset": null,
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
              portrait: null,
              "portrait-alternative-text": null,
            },
            writeToken: state.writeToken,
          },
          kind: "replace",
        }),
      ),
    ],
  buildImageReplacementMutations = <Input extends BuildImageReplacementMutationsInput>(
    input: Readonly<Input>,
  ): Cms.EntryBatchMutation[] => [
    ...input.postStates.map(
      (state): Cms.EntryBatchMutation => ({
        input: {
          contentTypeId: "post",
          entryId: state.entry.id,
          values: {
            ...state.entry.values,
            body: replaceRichTextAsset(
              state.entry.values["body"] ?? null,
              input.oldAssetId,
              input.newAssetId,
            ),
            ...conditionalProperty(
              state.entry.values["featured-asset"] === input.oldAssetId,
              "featured-asset",
              input.newAssetId,
            ),
          },
          writeToken: state.writeToken,
        },
        kind: "replace",
      }),
    ),
    ...input.authorStates.map(
      (state): Cms.EntryBatchMutation => ({
        input: {
          contentTypeId: "author",
          entryId: state.entry.id,
          values: {
            ...state.entry.values,
            profile: replaceRichTextAsset(
              state.entry.values["profile"] ?? null,
              input.oldAssetId,
              input.newAssetId,
            ),
            ...conditionalProperty(
              state.entry.values["portrait"] === input.oldAssetId,
              "portrait",
              input.newAssetId,
            ),
          },
          writeToken: state.writeToken,
        },
        kind: "replace",
      }),
    ),
  ],
  loadAssetAssignmentStates = (
    cms: Readonly<Cms.ServiceShape>,
    assetId: string,
  ): Effect.Effect<
    {
      readonly authorStates: readonly EntryAssignmentState[];
      readonly postStates: readonly EntryAssignmentState[];
    },
    CmsError.CmsError
  > =>
    Effect.gen(function* loadAssetAssignmentEntryStates() {
      const authorStates = yield* Effect.all(
          (yield* queryAllEntries(cms, { contentTypeId: "author", pageSize: 100 }))
            .filter((author) => author.values["portrait"] === assetId)
            .map((author) =>
              cms.getCurrentEntryState({ contentTypeId: "author", entryId: author.id }),
            ),
        ),
        postStates = yield* Effect.all(
          (yield* queryAllEntries(cms, { contentTypeId: "post", pageSize: 100 }))
            .filter((post) => post.values["featured-asset"] === assetId)
            .map((post) => cms.getCurrentEntryState({ contentTypeId: "post", entryId: post.id })),
        );
      return { authorStates, postStates };
    }),
  loadImageReplacementStates = (
    cms: Readonly<Cms.ServiceShape>,
    oldAssetId: string,
  ): Effect.Effect<
    {
      readonly authorStates: readonly EntryAssignmentState[];
      readonly postStates: readonly EntryAssignmentState[];
    },
    CmsError.CmsError
  > =>
    Effect.gen(function* loadImageReplacementEntryStates() {
      const authorStates = yield* Effect.all(
          (yield* cms.queryEntries({ contentTypeId: "author", pageSize: 100 })).items
            .filter((author) =>
              usesAsset({
                assetId: oldAssetId,
                directField: "portrait",
                richTextField: "profile",
                values: author.values,
              }),
            )
            .map((author) =>
              cms.getCurrentEntryState({ contentTypeId: "author", entryId: author.id }),
            ),
        ),
        postStates = yield* Effect.all(
          (yield* cms.queryEntries({ contentTypeId: "post", pageSize: 100 })).items
            .filter((post) =>
              usesAsset({
                assetId: oldAssetId,
                directField: "featured-asset",
                richTextField: "body",
                values: post.values,
              }),
            )
            .map((post) => cms.getCurrentEntryState({ contentTypeId: "post", entryId: post.id })),
        );
      return { authorStates, postStates };
    });

export default {
  buildImageClearingMutations,
  buildImageReplacementMutations,
  loadAssetAssignmentStates,
  loadImageReplacementStates,
};
