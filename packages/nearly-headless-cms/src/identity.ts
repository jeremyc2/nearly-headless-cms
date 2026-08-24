import type { Effect } from "effect";
import { Context } from "effect";

/** Explicit identity state for a request without an Actor. */
export interface Anonymous {
  readonly state: "anonymous";
}

/** A Builder-owned opaque Actor value carried through request scope. */
export interface Actor<ActorValue = unknown> {
  readonly state: "actor";
  readonly actor: ActorValue;
}

/** The request identity supplied to Authorization. */
export type Identity<ActorValue = unknown> = Anonymous | Actor<ActorValue>;

/** The canonical Anonymous identity value. */
export const anonymous: Anonymous = { state: "anonymous" };

/** Builder-supplied request-scoped Current Identity capability. */
export class CurrentIdentity extends Context.Service<
  CurrentIdentity,
  {
    readonly current: Effect.Effect<Identity>;
  }
>()("nearly-headless-cms/Identity/CurrentIdentity") {}
