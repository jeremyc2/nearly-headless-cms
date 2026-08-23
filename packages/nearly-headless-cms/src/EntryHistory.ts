import type { Representation } from "./Entry.ts";
import type { JsonObject } from "./internal/json.ts";

export interface RevisionMetadata {
  readonly revisionNumber: number;
  readonly recordedAt: string;
  readonly definitionSnapshotId: string;
  readonly restoredFromRevisionNumber?: number;
}

export interface Revision extends RevisionMetadata {
  readonly values: JsonObject;
}

export interface CurrentState {
  readonly entry: Representation;
  readonly writeToken: string;
  readonly revisionNumber: number;
}

export interface DeletionRecord {
  readonly entryId: string;
  readonly contentTypeId: string;
  readonly deletedAt: string;
  readonly latestRevisionNumber: number;
  readonly writeToken: string;
}

export interface RevisionPage {
  readonly items: readonly RevisionMetadata[];
  readonly nextCursor?: string;
}

export interface ListRevisionsInput {
  readonly contentTypeId: string;
  readonly entryId: string;
  readonly pageSize: number;
  readonly cursor?: string;
}

export interface RestoreInput {
  readonly contentTypeId: string;
  readonly entryId: string;
  readonly revisionNumber: number;
  readonly writeToken: string;
}
