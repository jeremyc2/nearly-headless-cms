import type { Effect } from "effect";
import { Context } from "effect";

export interface Anonymous {
  readonly state: "anonymous";
}

export interface Actor<ActorValue = unknown> {
  readonly state: "actor";
  readonly actor: ActorValue;
}

export type Identity<ActorValue = unknown> = Anonymous | Actor<ActorValue>;

export const anonymous: Anonymous = { state: "anonymous" };

export class CurrentIdentity extends Context.Service<
  CurrentIdentity,
  {
    readonly current: Effect.Effect<Identity>;
  }
>()("nearly-headless-cms/Identity/CurrentIdentity") {}
