import { Schema } from "effect";

export interface ValidationIssue {
  readonly path: readonly (string | number)[];
  readonly reason: string;
  readonly message: string;
}

export class InvalidInput extends Schema.TaggedError<InvalidInput>()("InvalidInput", {
  issues: Schema.optional(
    Schema.Array(
      Schema.Struct({
        path: Schema.Array(Schema.Union([Schema.String, Schema.Number])),
        reason: Schema.String,
        message: Schema.String,
      }),
    ),
  ),
  message: Schema.String,
}) {}

export class Forbidden extends Schema.TaggedError<Forbidden>()("Forbidden", {
  message: Schema.String,
}) {}

export class NotFound extends Schema.TaggedError<NotFound>()("NotFound", {
  message: Schema.String,
}) {}

export class Conflict extends Schema.TaggedError<Conflict>()("Conflict", {
  message: Schema.String,
}) {}

export class UnsupportedQueryCapability extends Schema.TaggedError<UnsupportedQueryCapability>()(
  "UnsupportedQueryCapability",
  { message: Schema.String },
) {}

export class ExportTooLarge extends Schema.TaggedError<ExportTooLarge>()("ExportTooLarge", {
  message: Schema.String,
}) {}

export class AssetReferenced extends Schema.TaggedError<AssetReferenced>()("AssetReferenced", {
  message: Schema.String,
}) {}

export class ReferenceBlockedDeletion extends Schema.TaggedError<ReferenceBlockedDeletion>()(
  "ReferenceBlockedDeletion",
  { message: Schema.String },
) {}

export class IdempotencyConflict extends Schema.TaggedError<IdempotencyConflict>()(
  "IdempotencyConflict",
  {
    message: Schema.String,
  },
) {}

export class DefinitionSnapshotChanged extends Schema.TaggedError<DefinitionSnapshotChanged>()(
  "DefinitionSnapshotChanged",
  { message: Schema.String },
) {}

export class InfrastructureFailure extends Schema.TaggedError<InfrastructureFailure>()(
  "InfrastructureFailure",
  {
    cause: Schema.optional(Schema.Defect()),
    message: Schema.String,
    retryable: Schema.Boolean,
  },
) {}

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
