import { Effect, Layer } from "effect";
import { Generator } from "../identifier.ts";

export const layer = Layer.succeed(
  Generator,
  Generator.of({
    generate: (kind) => Effect.sync(() => `${kind}-${crypto.randomUUID()}`),
  }),
);
