import type { Cms, EntryQuery } from "nearly-headless-cms";

export interface PublicReachabilityInput {
  readonly authors: readonly Cms.ConsistentReadSnapshot["entries"][number][];
  readonly categories: readonly Cms.ConsistentReadSnapshot["entries"][number][];
  readonly posts: readonly Cms.ConsistentReadSnapshot["entries"][number][];
  readonly tags: readonly Cms.ConsistentReadSnapshot["entries"][number][];
}

export interface QuerySnapshotInput {
  readonly consistentSnapshot: Cms.ConsistentReadSnapshot;
  readonly contentTypeId: string;
  readonly sort?: readonly EntryQuery.Sort[];
  readonly where?: EntryQuery.Predicate;
}

export interface ReachabilityState {
  readonly entriesByIdentifier: ReadonlyMap<string, Cms.ConsistentReadSnapshot["entries"][number]>;
  readonly pendingDocuments: unknown[];
  readonly publicAuthorIdentifiers: Set<string>;
  readonly publicCategoryIdentifiers: Set<string>;
  readonly publicTagIdentifiers: Set<string>;
  readonly richTextReachableIdentifiers: Set<string>;
}

export type SnapshotEntry = Cms.ConsistentReadSnapshot["entries"][number];
