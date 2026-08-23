import type { Effect } from "effect";
import { Context } from "effect";
import type { InfrastructureFailure } from "./CmsError.ts";

export type Kind =
  | "entry"
  | "asset"
  | "write-token"
  | "snapshot"
  | "migration"
  | "request"
  | "idempotency";

export class Generator extends Context.Service<
  Generator,
  {
    readonly generate: (kind: Kind) => Effect.Effect<string, InfrastructureFailure>;
  }
>()("nearly-headless-cms/Identifier/Generator") {}
