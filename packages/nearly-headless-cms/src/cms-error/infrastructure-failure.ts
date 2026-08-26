import { Schema } from "effect";

const InfrastructureFailureKind = Schema.Literals([
    "capacity",
    "corruption",
    "permission",
    "transientIo",
    "unsupportedCapability",
  ]),
  makeTaggedErrorClass = Schema.TaggedError;

export { InfrastructureFailureKind };

export type InfrastructureFailureKind = typeof InfrastructureFailureKind.Type;

/** A sanitized Adapter failure, retaining the original cause outside transport output. */
export class InfrastructureFailure extends makeTaggedErrorClass<InfrastructureFailure>()(
  "InfrastructureFailure",
  {
    cause: Schema.optional(Schema.Defect()),
    kind: Schema.optional(InfrastructureFailureKind),
    message: Schema.String,
    retryable: Schema.Boolean,
  },
) {}
