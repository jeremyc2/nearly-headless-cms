import type { HttpTransport } from "nearly-headless-cms/http";
import { Filesystem } from "nearly-headless-cms/layers";
import type { Layer } from "effect";
import type { Cms, CmsError } from "nearly-headless-cms";
import { definitionSnapshot } from "./definitions.ts";
import { makeDeliveryOperations } from "./delivery.ts";

export interface MinimalComposition {
  readonly cmsLayer: Layer.Layer<Cms.Service, CmsError.InfrastructureFailure>;
  readonly transportOptions: HttpTransport.Options;
}

/** Composes filesystem persistence, note Delivery Queries, and the HTTP transport. */
export const makeMinimalComposition = (
  storageRoot = ".data/example-cms-minimal",
): MinimalComposition => {
  const deliveryOperations = makeDeliveryOperations(),
    cmsLayer = Filesystem.cms({
      definitionSnapshot,
      operationContracts: deliveryOperations,
      root: `${storageRoot}/persistence`,
    }),
    transportOptions: HttpTransport.Options = { deliveryOperations };

  return { cmsLayer, transportOptions };
};
