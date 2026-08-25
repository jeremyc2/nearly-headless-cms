import { type CommandReceiptStore, memoryCommandReceiptStore } from "./command-receipt-store.ts";
import type { HttpContract } from "nearly-headless-cms/http";
import managementCascadeDeletions from "./management-cascade-deletions.ts";
import managementEditorialTransitions from "./management-editorial-transitions.ts";
import managementImageOperations from "./management-image-operations.ts";
import managementOperationRoutes from "./management-operation-routes.ts";
import managementTaxonomyOperations from "./management-taxonomy-operations.ts";

export interface ManagementOperationOptions {
  readonly commandReceiptStore?: CommandReceiptStore;
}

export const makeManagementOperations = (
  options: ManagementOperationOptions = {},
): readonly HttpContract.ManagementOperation[] => {
  const commandReceiptStore = options.commandReceiptStore ?? memoryCommandReceiptStore(),
    { makeDeleteImageAndClearAssignments, makeReplaceImage } = managementImageOperations,
    { deleteAuthorWithPostsAndComments, deletePostWithComments } = managementCascadeDeletions,
    { detachTaxonomy } = managementTaxonomyOperations,
    { transition } = managementEditorialTransitions,
    { buildManagementOperationRoutes } = managementOperationRoutes;

  return buildManagementOperationRoutes({
    deleteAuthorWithPostsAndComments,
    deleteImageAndClearAssignments: makeDeleteImageAndClearAssignments(commandReceiptStore),
    deletePostWithComments,
    detachTaxonomy,
    listExampleAssets: ({ cms }) => cms.listAssets,
    replaceImage: makeReplaceImage(commandReceiptStore),
    transition,
  });
};
