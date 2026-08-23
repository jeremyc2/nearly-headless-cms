import { Effect, Layer } from "effect";
import { CurrentIdentity, anonymous } from "../Identity.ts";

export const layer = Layer.succeed(
  CurrentIdentity,
  CurrentIdentity.of({ current: Effect.succeed(anonymous) }),
);
