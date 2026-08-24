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

export { AssetReferenced } from "./cms-error/asset-referenced.ts";
export { Conflict } from "./cms-error/conflict.ts";
export { DefinitionSnapshotChanged } from "./cms-error/definition-snapshot-changed.ts";
export { ExportTooLarge } from "./cms-error/export-too-large.ts";
export { Forbidden } from "./cms-error/forbidden.ts";
export { IdempotencyConflict } from "./cms-error/idempotency-conflict.ts";
export { InfrastructureFailure } from "./cms-error/infrastructure-failure.ts";
export { InvalidInput, type ValidationIssue } from "./cms-error/invalid-input.ts";
export { NotFound } from "./cms-error/not-found.ts";
export { ReferenceBlockedDeletion } from "./cms-error/reference-blocked-deletion.ts";
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
