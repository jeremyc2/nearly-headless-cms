import { Schema } from "effect";

const makeTaggedErrorClass = Schema.TaggedError;

/** Failure to read or durably write an idempotent command receipt. */
export class CommandReceiptStoreFailure extends makeTaggedErrorClass<CommandReceiptStoreFailure>()(
  "CommandReceiptStoreFailure",
  {
    cause: Schema.optional(Schema.Unknown),
    message: Schema.String,
  },
) {}
