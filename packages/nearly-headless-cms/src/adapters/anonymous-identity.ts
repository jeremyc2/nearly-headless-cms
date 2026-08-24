import { CurrentIdentity, anonymous } from "../identity.ts";
import { Effect, Layer } from "effect";

/** Current Identity Layer that supplies the explicit Anonymous state. */
export const layer = Layer.succeed(
  CurrentIdentity,
  CurrentIdentity.of({ current: Effect.succeed(anonymous) }),
);
