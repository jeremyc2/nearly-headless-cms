import { Context, type Effect } from "effect";
import type { InfrastructureFailure } from "./cms-error.ts";

/** Address and scoped close action for a running Builder Transport. */
export interface RunningTransport {
  readonly address: string;
  readonly close: Effect.Effect<void>;
}

/** Builder-supplied capability that starts and stops the composed CMS Transport. */
export class Service extends Context.Service<
  Service,
  {
    readonly start: Effect.Effect<RunningTransport, InfrastructureFailure>;
  }
>()("nearly-headless-cms/transport/Service") {}
