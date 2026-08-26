import type { CommandReceiptStore } from "../shared/command-receipt-store.ts";
import { CmsError } from "nearly-headless-cms";
import { Effect } from "effect";
import { type ReadonlyTransportRequest } from "nearly-headless-cms/http";

interface CommandReceiptInput {
  readonly commandKey: string;
  readonly commandReceiptStore: CommandReceiptStore;
  readonly failureMessage: string;
  readonly receiptScope: string;
}

interface WriteCommandReceiptInput extends CommandReceiptInput {
  readonly receipt: unknown;
}

const readCommandReceipt = ({
    commandKey,
    commandReceiptStore,
    failureMessage,
    receiptScope,
  }: Readonly<CommandReceiptInput>): Effect.Effect<unknown, CmsError.InfrastructureFailure> =>
    commandReceiptStore.read(receiptScope, commandKey).pipe(
      Effect.mapError((cause) =>
        CmsError.InfrastructureFailure.make({
          cause,
          message: failureMessage,
          retryable: true,
        }),
      ),
    ),
  requireIdempotencyKey = (
    request: ReadonlyTransportRequest,
  ): Effect.Effect<string, CmsError.InvalidInput> => {
    const commandKey = request.headers.get("idempotency-key");
    if (commandKey === null || commandKey.length === 0) {
      return CmsError.InvalidInput.make({ message: "Idempotency-Key is required" });
    }
    return Effect.succeed(commandKey);
  },
  writeCommandReceipt = ({
    commandKey,
    commandReceiptStore,
    failureMessage,
    receipt,
    receiptScope,
  }: Readonly<WriteCommandReceiptInput>): Effect.Effect<void, CmsError.InfrastructureFailure> =>
    commandReceiptStore.write(receiptScope, commandKey, receipt).pipe(
      Effect.mapError((cause) =>
        CmsError.InfrastructureFailure.make({
          cause,
          message: failureMessage,
          retryable: true,
        }),
      ),
    );

export default {
  readCommandReceipt,
  requireIdempotencyKey,
  writeCommandReceipt,
};
