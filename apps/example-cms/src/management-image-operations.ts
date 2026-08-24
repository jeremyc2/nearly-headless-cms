import { type Cms } from "nearly-headless-cms";
import { Effect } from "effect";
import type { HttpContract } from "nearly-headless-cms/http";
import { type CommandReceiptStore } from "./command-receipt-store.ts";
import managementImageAssignmentSupport from "./management-image-assignment-support.ts";
import managementImageReceiptSupport from "./management-image-receipt-support.ts";
import managementImageUploadSupport from "./management-image-upload-support.ts";
import managementSupport from "./management-support.ts";

interface ClearImageAssignmentsInput {
  readonly assetId: string;
  readonly cms: Cms.ServiceShape;
  readonly commandKey: string;
  readonly commandReceiptStore: CommandReceiptStore;
}

interface PersistImageDeletionReceiptInput extends ClearImageAssignmentsInput {
  readonly authorStates: readonly unknown[];
  readonly postStates: readonly unknown[];
}

const { requiredParameter } = managementSupport,
  {
    buildImageClearingMutations,
    buildImageReplacementMutations,
    loadAssetAssignmentStates,
    loadImageReplacementStates,
  } = managementImageAssignmentSupport,
  { readCommandReceipt, requireIdempotencyKey, writeCommandReceipt } =
    managementImageReceiptSupport,
  { parseReplacementUpload } = managementImageUploadSupport,
  clearImageAssignmentsAndDelete = ({
    assetId,
    cms,
    commandKey,
    commandReceiptStore,
  }: ClearImageAssignmentsInput) =>
    Effect.gen(function* clearImageAssignmentsBeforeDeletion() {
      yield* cms.getAsset(assetId);
      const { authorStates, postStates } = yield* loadAssetAssignmentStates(cms, assetId),
        mutations = buildImageClearingMutations(authorStates, postStates);
      if (mutations.length > 0) {
        yield* cms.mutateEntriesAtomically(mutations);
      }
      yield* cms.deleteAsset(assetId);
      return yield* persistImageDeletionReceipt({
        assetId,
        authorStates,
        cms,
        commandKey,
        commandReceiptStore,
        postStates,
      });
    }),
  finalizeImageReplacement = (
    cms: Cms.ServiceShape,
    mutations: readonly Cms.EntryBatchMutation[],
    oldAssetId: string,
  ) =>
    Effect.gen(function* finalizeImageReplacementAfterMutation() {
      if (mutations.length > 0) {
        yield* cms.mutateEntriesAtomically([...mutations]);
      }
      return yield* cms.deleteAsset(oldAssetId).pipe(
        Effect.as(true),
        Effect.catchTag("AssetReferenced", () => Effect.succeed(false)),
      );
    }),
  makeDeleteImageAndClearAssignments =
    (
      commandReceiptStore: CommandReceiptStore,
    ): HttpContract.ManagementOperation["execute"] =>
    ({ cms, parameters, request }) =>
      Effect.gen(function* deleteImageAfterClearingAssignments() {
        const assetId = requiredParameter(parameters, "assetId"),
          commandKey = yield* requireIdempotencyKey(request),
          prior = yield* readCommandReceipt({
            commandKey,
            commandReceiptStore,
            failureMessage: "Image deletion receipt lookup failed",
            receiptScope: `image-deletion:${assetId}`,
          });
        if (prior !== undefined) {
          return prior;
        }
        return yield* clearImageAssignmentsAndDelete({
          assetId,
          cms,
          commandKey,
          commandReceiptStore,
        });
      }),
  makeReplaceImage =
    (commandReceiptStore: CommandReceiptStore): HttpContract.ManagementOperation["execute"] =>
    ({ cms, parameters, request }) =>
      Effect.gen(function* replaceImageAsset() {
        const commandKey = yield* requireIdempotencyKey(request),
          oldAssetId = requiredParameter(parameters, "assetId"),
          prior = yield* readCommandReceipt({
            commandKey,
            commandReceiptStore,
            failureMessage: "Image replacement receipt lookup failed",
            receiptScope: `image-replacement:${oldAssetId}`,
          });
        if (prior !== undefined) {
          return prior;
        }
        return yield* completeImageReplacement({
          cms,
          commandKey,
          commandReceiptStore,
          oldAssetId,
          request,
        });
      }),
  completeImageReplacement = ({
    cms,
    commandKey,
    commandReceiptStore,
    oldAssetId,
    request,
  }: {
    readonly cms: Cms.ServiceShape;
    readonly commandKey: string;
    readonly commandReceiptStore: CommandReceiptStore;
    readonly oldAssetId: string;
    readonly request: Request;
  }) =>
    Effect.gen(function* completeImageReplacementWorkflow() {
      const newAsset = yield* cms.ingestAsset(yield* parseReplacementUpload(request)),
        { authorStates, postStates } = yield* loadImageReplacementStates(cms, oldAssetId),
        mutations = buildImageReplacementMutations({
          authorStates,
          newAssetId: newAsset.id,
          oldAssetId,
          postStates,
        }),
        oldAssetDeleted = yield* finalizeImageReplacement(cms, mutations, oldAssetId),
        receipt = {
          ingestionCompleted: true,
          newAssetId: newAsset.id,
          oldAssetDeleted,
          oldAssetId,
          reassignedEntryCount: mutations.length,
          reassignmentCompleted: true,
        };
      yield* writeCommandReceipt({
        commandKey,
        commandReceiptStore,
        failureMessage: "Image replacement receipt persistence failed",
        receipt,
        receiptScope: `image-replacement:${oldAssetId}`,
      });
      return receipt;
    }),
  persistImageDeletionReceipt = ({
    assetId,
    authorStates,
    commandKey,
    commandReceiptStore,
    postStates,
  }: PersistImageDeletionReceiptInput) => {
    const receipt = {
      clearedAuthorCount: authorStates.length,
      clearedPostCount: postStates.length,
      deletedAssetId: assetId,
      deletionCompleted: true,
    };
    return writeCommandReceipt({
      commandKey,
      commandReceiptStore,
      failureMessage: "Image deletion receipt persistence failed",
      receipt,
      receiptScope: `image-deletion:${assetId}`,
    }).pipe(Effect.as(receipt));
  };

export default {
  makeDeleteImageAndClearAssignments,
  makeReplaceImage,
};
