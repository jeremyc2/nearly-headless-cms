import { Effect, Layer } from "effect";
import { Service } from "../Authorization.ts";

export const layer = Layer.succeed(Service, Service.of({ authorize: () => Effect.succeed(true) }));
