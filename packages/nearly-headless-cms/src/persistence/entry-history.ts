import type { CmsError, InfrastructureFailure } from "../cms-error.ts";
import { Context, type Effect } from "effect";
import type { EntryGeneration } from "./entry-persistence.ts";

/** Optional Builder-supplied generation history and rollback capability. */
export class EntryHistory extends Context.Service<
  EntryHistory,
  {
    readonly generations: (_void: void) => Effect.Effect<readonly number[], InfrastructureFailure>;
    readonly rollbackTo: (generation: number) => Effect.Effect<number, CmsError>;
    readonly snapshot: (generation: number) => Effect.Effect<EntryGeneration, CmsError>;
  }
>()("nearly-headless-cms/persistence/entry-history/EntryHistory") {}
