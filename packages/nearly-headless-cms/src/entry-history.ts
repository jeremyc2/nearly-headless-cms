import type { Representation } from "./entry.ts";
import type { JsonObject } from "./internal/json.ts";

/** Metadata that identifies an immutable Entry Revision. */
export interface RevisionMetadata {
  readonly revisionNumber: number;
  readonly recordedAt: string;
  readonly definitionSnapshotId: string;
  readonly restoredFromRevisionNumber?: number;
}

/** An immutable complete snapshot of an Entry's Field values. */
export interface Revision extends RevisionMetadata {
  readonly values: JsonObject;
}

/** The current Entry representation and optimistic-concurrency state. */
export interface CurrentState {
  readonly entry: Representation;
  readonly writeToken: string;
  readonly revisionNumber: number;
}

/** Retained state for a history-enabled deleted Entry. */
export interface DeletionRecord {
  readonly entryId: string;
  readonly contentTypeId: string;
  readonly deletedAt: string;
  readonly latestRevisionNumber: number;
  readonly writeToken: string;
}

/** One bounded, cursor-paginated page of Entry Revisions. */
export interface RevisionPage {
  readonly items: readonly RevisionMetadata[];
  readonly nextCursor?: string;
}

/** Input for listing an Entry's retained revisions. */
export interface ListRevisionsInput {
  readonly contentTypeId: string;
  readonly entryId: string;
  readonly pageSize: number;
  readonly cursor?: string;
}

/** Input for restoring a retained revision as a new current revision. */
export interface RestoreInput {
  readonly contentTypeId: string;
  readonly entryId: string;
  readonly revisionNumber: number;
  readonly writeToken: string;
}
