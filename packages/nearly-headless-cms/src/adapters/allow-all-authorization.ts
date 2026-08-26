import { Effect, Layer } from "effect";
import { Service } from "../authorization.ts";

/** Open-access Authorization Layer that permits every generic CMS Action. */
export const layer = Layer.succeed(Service, Service.of({ authorize: () => Effect.succeed(true) }));
