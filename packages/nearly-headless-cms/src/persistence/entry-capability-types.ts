import type { CompiledSnapshot } from "../content-definition.ts";
import type { Query, QueryPage } from "../entry-query.ts";
import type { EntryRecord } from "./entry-persistence.ts";

/** One Entry record read from an internally consistent persistence generation. */
export interface EntryReadResult {
  readonly generation: number;
  readonly record?: EntryRecord;
}

/** Inputs required for an Adapter to execute the portable Entry Query algebra. */
export interface EntryQueryInput {
  readonly query: Query;
  readonly snapshot: CompiledSnapshot;
}

/** One query page paired with the persistence generation that produced it. */
export interface EntryQueryResult {
  readonly generation: number;
  readonly page: QueryPage;
}

/** One row-level change in an atomic Entry commit. */
export type EntryChange =
  | { readonly kind: "put"; readonly entryId: string; readonly record: EntryRecord }
  | { readonly kind: "delete"; readonly entryId: string };

/** Atomic row-level Entry changes guarded by an optimistic persistence generation. */
export interface EntryCommit {
  readonly expectedGeneration: number;
  readonly changes: readonly EntryChange[];
}
