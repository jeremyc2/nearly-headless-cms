import { Schema } from "effect";

const makeTaggedErrorClass = Schema.TaggedError;

/** A sanitized Adapter failure, retaining the original cause outside transport output. */
export class InfrastructureFailure extends makeTaggedErrorClass<InfrastructureFailure>()(
  "InfrastructureFailure",
  {
    cause: Schema.optional(Schema.Defect()),
    message: Schema.String,
    retryable: Schema.Boolean,
  },
) {}
