import type { CmsError } from "../cms-error.ts";
import { Context, type Effect } from "effect";
import type { EntryCommit } from "./entry-capability-types.ts";

/** Builder-supplied atomic, row-level Entry write capability. */
export class EntryWriter extends Context.Service<
  EntryWriter,
  {
    readonly commit: (input: Readonly<EntryCommit>) => Effect.Effect<number, CmsError>;
  }
>()("nearly-headless-cms/persistence/entry-writer/EntryWriter") {}
