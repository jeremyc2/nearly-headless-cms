import type { Effect } from "effect";
import { Context } from "effect";
import type { InfrastructureFailure } from "./CmsError.ts";
import type { Identity } from "./Identity.ts";
import type { Action, Resource } from "./Operation.ts";

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
