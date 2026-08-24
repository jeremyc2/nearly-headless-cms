import type { Effect } from "effect";
import { Context } from "effect";
import type { InfrastructureFailure } from "./cms-error.ts";
import type { Identity } from "./identity.ts";
import type { Action, Resource } from "./operation.ts";

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
>()("nearly-headless-cms/Authorization/Service") {}
