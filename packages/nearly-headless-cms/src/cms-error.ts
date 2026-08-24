import { Schema } from "effect";

/** A stable machine-readable validation issue at an unambiguous Field path. */
export interface ValidationIssue {
  readonly path: readonly (string | number)[];
  readonly reason: string;
  readonly message: string;
}

/** The request or persisted value violated a declared CMS invariant. */
export class InvalidInput extends Schema.TaggedError<InvalidInput>()("InvalidInput", {
  issues: Schema.optional(
    Schema.Array(
      Schema.Struct({
        message: Schema.String,
        path: Schema.Array(Schema.Union([Schema.String, Schema.Number])),
        reason: Schema.String,
      }),
    ),
  ),
  message: Schema.String,
}) {}

/** Authorization denied the requested Action without revealing existence. */
export class Forbidden extends Schema.TaggedError<Forbidden>()("Forbidden", {
  message: Schema.String,
}) {}

/** The authorized resource does not exist. */
export class NotFound extends Schema.TaggedError<NotFound>()("NotFound", {
  message: Schema.String,
}) {}

/** Current persisted state conflicts with the requested state transition. */
export class Conflict extends Schema.TaggedError<Conflict>()("Conflict", {
  message: Schema.String,
}) {}

/** A Query requires behavior the relevant Field Kind or Adapter cannot provide exactly. */
export class UnsupportedQueryCapability extends Schema.TaggedError<UnsupportedQueryCapability>()(
  "UnsupportedQueryCapability",
  { message: Schema.String },
) {}

/** A bounded public export exceeded its configured maximum size. */
export class ExportTooLarge extends Schema.TaggedError<ExportTooLarge>()("ExportTooLarge", {
  message: Schema.String,
}) {}

/** A live Entry or Rich Text reference prevents Asset deletion. */
export class AssetReferenced extends Schema.TaggedError<AssetReferenced>()("AssetReferenced", {
  message: Schema.String,
}) {}

/** A live Relationship or Rich Text reference prevents Entry deletion. */
export class ReferenceBlockedDeletion extends Schema.TaggedError<ReferenceBlockedDeletion>()(
  "ReferenceBlockedDeletion",
  { message: Schema.String },
) {}

/** An idempotency key was reused for a different command payload. */
export class IdempotencyConflict extends Schema.TaggedError<IdempotencyConflict>()(
  "IdempotencyConflict",
  {
    message: Schema.String,
  },
) {}

/** The active Definition fingerprint no longer matches a request precondition. */
export class DefinitionSnapshotChanged extends Schema.TaggedError<DefinitionSnapshotChanged>()(
  "DefinitionSnapshotChanged",
  { message: Schema.String },
) {}

/** A sanitized Adapter failure, retaining the original cause outside transport output. */
export class InfrastructureFailure extends Schema.TaggedError<InfrastructureFailure>()(
  "InfrastructureFailure",
  {
    cause: Schema.optional(Schema.Defect()),
    message: Schema.String,
    retryable: Schema.Boolean,
  },
) {}

/** The complete expected failure channel of public CMS operations. */
export type CmsError =
  | InvalidInput
  | Forbidden
  | NotFound
  | Conflict
  | UnsupportedQueryCapability
  | ExportTooLarge
  | AssetReferenced
  | ReferenceBlockedDeletion
  | IdempotencyConflict
  | DefinitionSnapshotChanged
  | InfrastructureFailure;
