import { type CommandReceiptStore, memoryCommandReceiptStore } from "../shared/command-receipt-store.ts";
import type { HttpContract } from "nearly-headless-cms/http";
import deliveryOperationRoutes from "./delivery-operation-routes-support.ts";

export {
  authorDefinitionRequirement,
  commentDefinitionRequirement,
  postDefinitionRequirement,
  taxonomyDefinitionRequirement,
} from "./delivery-definition-requirements.ts";

export interface DeliveryOperationOptions {
  readonly commandReceiptStore?: CommandReceiptStore;
}

export const makeDeliveryOperations = (
  options: DeliveryOperationOptions = {},
): readonly HttpContract.DeliveryOperation[] => {
  const commandReceiptStore = options.commandReceiptStore ?? memoryCommandReceiptStore(),
    { buildDeliveryOperationRoutes } = deliveryOperationRoutes;

  return buildDeliveryOperationRoutes(commandReceiptStore);
};
