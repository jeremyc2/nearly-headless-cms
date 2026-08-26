import type { DeliveryOperation, ManagementOperation } from "./http-contract.ts";
import type { OperationDescriptor } from "./open-api-types.ts";

const customDescriptor = <Operation extends DeliveryOperation | ManagementOperation>(
    operation: Readonly<Operation>,
  ): OperationDescriptor => {
    const operationDescriptor: OperationDescriptor = {
      operationIdentifier: operation.identifier,
      schemas: operation.schemas,
    };
    if (
      "successStatus" in operation &&
      typeof operation.successStatus === "number" &&
      operation.successStatus !== undefined
    ) {
      return { ...operationDescriptor, successStatus: operation.successStatus };
    }
    return operationDescriptor;
  },
  descriptor = (operationIdentifier: string): OperationDescriptor => ({ operationIdentifier });

export default { customDescriptor, descriptor };
