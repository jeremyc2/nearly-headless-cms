import type { Operation } from "nearly-headless-cms";
import { Cms } from "nearly-headless-cms";
import { Layer } from "effect";
import { definitionSnapshot } from "../content/definitions.ts";
import { layer as authorizationLayer } from "./authorization.ts";
import { forStorageRoot } from "./identifiers.ts";
import { layer as identityLayer } from "./identity.ts";
import { layer as persistenceLayer } from "./persistence.ts";

/** Composes the example CMS service from one layer per dependency. */
export const layer = ({
  operationContracts,
  storageRoot,
}: {
  readonly operationContracts: readonly Operation.DefinitionContract[];
  readonly storageRoot: string | undefined;
}) => {
  const storageDirectory = storageRoot ?? ".data/example-cms",
    persistence = persistenceLayer({
      definitionSnapshot,
      root: `${storageDirectory}/persistence`,
      storageRoot,
    }),
    dependencies = Layer.mergeAll(
      authorizationLayer,
      forStorageRoot(storageRoot),
      identityLayer,
      persistence,
    );

  return Cms.makeLayer({ operationContracts }).pipe(Layer.provide(dependencies));
};
