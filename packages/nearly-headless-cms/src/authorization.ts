import type { Action, Resource } from "./operation.ts";
import { Context, type Effect } from "effect";
import type { Identity } from "./identity.ts";
import type { InfrastructureFailure } from "./cms-error.ts";

/** Builder policy that authorizes one closed CMS Action and Resource pair. */
export class Service extends Context.Service<
  Service,
  {
    readonly authorize: (
      identity: Identity,
      action: Action,
      resource: Resource,
    ) => Effect.Effect<boolean, InfrastructureFailure>;
  }
>()("nearly-headless-cms/authorization/Service") {}
