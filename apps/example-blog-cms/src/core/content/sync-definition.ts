import { Cms } from "nearly-headless-cms";
import { Effect } from "effect";
import { definitionSnapshot } from "./definitions.ts";

/** Ensures persisted storage matches the code definition snapshot. */
export const syncDefinition = Effect.gen(function* syncDefinitionEffect() {
  const cms = yield* Cms.Service,
    activeSnapshot = yield* cms.activeDefinitionSnapshot();
  if (activeSnapshot.fingerprint === definitionSnapshot.fingerprint) {
    return yield* Effect.void;
  }
  return yield* Effect.die(
    "Example Blog CMS definition changed; delete .data/example-blog-cms and restart",
  );
});
