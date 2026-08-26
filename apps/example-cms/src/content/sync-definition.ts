import { Cms } from "nearly-headless-cms";
import { Effect } from "effect";
import { definitionSnapshot, definitionSource } from "./definitions.ts";

const guideContentTypeDefinition = definitionSource.definitions.find(
    (definition) => "id" in definition && definition.id === "guide",
  ),
  syncDefinitionIfNeeded = Effect.gen(function* syncDefinitionIfNeededEffect() {
    if (guideContentTypeDefinition === undefined) {
      return yield* Effect.die("Example Blog guide Content Type definition is missing");
    }
    const cms = yield* Cms.Service,
      activeSnapshot = yield* cms.activeDefinitionSnapshot();
    if (activeSnapshot.fingerprint === definitionSnapshot.fingerprint) {
      return yield* Effect.void;
    }
    if (activeSnapshot.contentTypes.has("guide")) {
      return yield* Effect.die(
        "Example Blog definition fingerprint changed without a startup migration path",
      );
    }
    const catalog = yield* cms.readDefinitionCatalog(),
      appendedRevision = yield* cms.appendDefinitionRevision({
        definition: guideContentTypeDefinition,
        expectedCatalogVersion: catalog.version,
        source: "example-cms startup",
      });
    yield* cms.activateDefinitionSnapshot({
      expectedCatalogVersion: appendedRevision.version,
      snapshot: definitionSource,
      source: "example-cms startup",
    });
    return yield* Effect.void;
  });

/** Activates the code definition when persisted storage is behind the Example Blog model. */
export { syncDefinitionIfNeeded as syncDefinition };
