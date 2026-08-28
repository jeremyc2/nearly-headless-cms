import type { CmsError, InfrastructureFailure } from "../cms-error.ts";
import { Context, type Effect } from "effect";
import type { EntryGeneration } from "./entry-persistence.ts";
import type {
  EntryQueryInput,
  EntryQueryResult,
  EntryReadResult,
} from "./entry-capability-types.ts";

/** Builder-supplied queryable Entry read capability. */
export class EntryReader extends Context.Service<
  EntryReader,
  {
    readonly get: (entryId: string) => Effect.Effect<EntryReadResult, InfrastructureFailure>;
    readonly query: (input: Readonly<EntryQueryInput>) => Effect.Effect<EntryQueryResult, CmsError>;
    readonly snapshot: (_void: void) => Effect.Effect<EntryGeneration, InfrastructureFailure>;
  }
>()("nearly-headless-cms/persistence/entry-reader/EntryReader") {}
