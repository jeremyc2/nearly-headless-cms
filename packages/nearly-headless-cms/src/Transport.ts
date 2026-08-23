import type { Effect } from "effect";
import { Context } from "effect";
import type { InfrastructureFailure } from "./CmsError.ts";

export interface RunningTransport {
  readonly address: string;
  readonly close: Effect.Effect<void>;
}

export class Service extends Context.Service<
  Service,
  {
    readonly start: Effect.Effect<RunningTransport, InfrastructureFailure>;
  }
>()("nearly-headless-cms/Transport/Service") {}
