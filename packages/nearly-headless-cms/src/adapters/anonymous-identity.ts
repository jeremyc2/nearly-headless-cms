import { Effect, Layer } from "effect";
import { CurrentIdentity, anonymous } from "../identity.ts";

/** Current Identity Layer that supplies the explicit Anonymous state. */
export const layer = Layer.succeed(
  CurrentIdentity,
  CurrentIdentity.of({ current: Effect.succeed(anonymous) }),
);
