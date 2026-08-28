import type { CmsError, InfrastructureFailure } from "../cms-error.ts";
import { Context, type Effect } from "effect";
import type { DeletionRecord, Revision } from "../entry-history.ts";
import type { Representation } from "../entry.ts";

/** Persisted current Entry state with optional history metadata. */
export interface EntryRecord {
  readonly deletionRecord?: DeletionRecord;
  readonly entry: Representation;
  readonly revisions: readonly Revision[];
  readonly writeToken?: string;
}

/** One immutable, internally consistent generation of Entry records. */
export interface EntryGeneration {
  readonly generation: number;
  readonly records: ReadonlyMap<string, EntryRecord>;
}

/**
 * Builder-supplied atomic Entry persistence capability.
 *
 * Compatibility seam for existing adapters. New adapters should implement `EntryReader` and
 * `EntryWriter` so reads can be queried and writes can be committed as row-level changes.
 */
export class EntryPersistence extends Context.Service<
  EntryPersistence,
  {
    readonly commitGeneration: (
      expectedGeneration: number,
      records: ReadonlyMap<string, EntryRecord>,
    ) => Effect.Effect<EntryGeneration, CmsError>;
    readonly readGeneration: (_void: void) => Effect.Effect<EntryGeneration, InfrastructureFailure>;
  }
>()("nearly-headless-cms/persistence/entry-persistence/EntryPersistence") {}
