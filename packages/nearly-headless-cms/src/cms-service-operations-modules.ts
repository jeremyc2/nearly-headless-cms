export type { CmsLayerOptions } from "./cms-types.ts";
export type { Handler } from "./definition-migration.ts";
import assetOperations from "./cms-service-asset-operations.ts";
import definitionActivationOperations from "./cms-service-definition-activation-operations.ts";
import definitionOperations from "./cms-service-definition-operations.ts";
import entryBatchOperations from "./cms-service-entry-batch-operations.ts";
import entryHistoryOperations from "./cms-service-entry-history-operations.ts";
import entryOperations from "./cms-service-entry-operations.ts";

export const cmsServiceOperationsModules = {
  asset: assetOperations,
  definition: definitionOperations,
  definitionActivation: definitionActivationOperations,
  entries: entryOperations,
  entryBatch: entryBatchOperations,
  entryHistory: entryHistoryOperations,
};
