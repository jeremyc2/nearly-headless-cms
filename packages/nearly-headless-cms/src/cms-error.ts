import type { AssetReferenced } from "./cms-error/asset-referenced.ts";
import type { Conflict } from "./cms-error/conflict.ts";
import type { DefinitionSnapshotChanged } from "./cms-error/definition-snapshot-changed.ts";
import type { ExportTooLarge } from "./cms-error/export-too-large.ts";
import type { Forbidden } from "./cms-error/forbidden.ts";
import type { IdempotencyConflict } from "./cms-error/idempotency-conflict.ts";
import type { InfrastructureFailure } from "./cms-error/infrastructure-failure.ts";
import type { InvalidInput } from "./cms-error/invalid-input.ts";
import type { NotFound } from "./cms-error/not-found.ts";
import type { ReferenceBlockedDeletion } from "./cms-error/reference-blocked-deletion.ts";
import type { UnsupportedQueryCapability } from "./cms-error/unsupported-query-capability.ts";

/** Failure returned when a live Entry still references an Asset. */
export { AssetReferenced } from "./cms-error/asset-referenced.ts";
/** Failure returned for stale versions, generations, or write tokens. */
export { Conflict } from "./cms-error/conflict.ts";
/** Failure returned when an operation's Definition Snapshot changes. */
export { DefinitionSnapshotChanged } from "./cms-error/definition-snapshot-changed.ts";
/** Failure returned when a public export exceeds its configured bound. */
export { ExportTooLarge } from "./cms-error/export-too-large.ts";
/** Failure returned when Authorization denies an operation. */
export { Forbidden } from "./cms-error/forbidden.ts";
/** Failure returned when an idempotency key is reused for different input. */
export { IdempotencyConflict } from "./cms-error/idempotency-conflict.ts";
/** Sanitized Adapter failure and its internal classification. */
export { InfrastructureFailure } from "./cms-error/infrastructure-failure.ts";
/** Invalid caller input and stable validation issue details. */
export { InvalidInput, type ValidationIssue } from "./cms-error/invalid-input.ts";
/** Failure returned when an authorized resource is absent. */
export { NotFound } from "./cms-error/not-found.ts";
/** Failure returned when live references block Entry deletion. */
export { ReferenceBlockedDeletion } from "./cms-error/reference-blocked-deletion.ts";
/** Failure returned when a Query needs an unavailable capability. */
export { UnsupportedQueryCapability } from "./cms-error/unsupported-query-capability.ts";

/** The complete expected failure channel of public CMS operations. */
export type CmsError =
  | AssetReferenced
  | Conflict
  | DefinitionSnapshotChanged
  | ExportTooLarge
  | Forbidden
  | IdempotencyConflict
  | InfrastructureFailure
  | InvalidInput
  | NotFound
  | ReferenceBlockedDeletion
  | UnsupportedQueryCapability;
