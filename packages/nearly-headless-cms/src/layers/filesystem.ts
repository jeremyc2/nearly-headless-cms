import type { CompileOptions, CompiledSnapshot } from "../content-definition.ts";
import {
  type CmsLayerOptions,
  type Service as CmsService,
  makeLayer as makeCmsLayer,
} from "../cms.ts";
import type { CmsConfiguration } from "../bun/filesystem/bun-filesystem-persistence-types.ts";
import type { InfrastructureFailure } from "../cms-error/infrastructure-failure.ts";
import { cmsLayer as filesystemPersistenceLayer } from "../bun/filesystem/bun-filesystem-persistence.ts";
import { development as developmentDependenciesLayer } from "./common-dependencies.ts";
import { Layer } from "effect";

/** Options for a filesystem-backed CMS layer with common development dependencies. */
export interface Options {
  readonly root: string;
  readonly definitionSnapshot: CompiledSnapshot;
  readonly compileOptions?: CompileOptions;
  readonly acknowledgement?: CmsConfiguration["acknowledgement"];
  readonly cmsOptions?: Omit<CmsLayerOptions, "operationContracts">;
  readonly operationContracts?: CmsLayerOptions["operationContracts"];
}

/** Composes filesystem persistence, development dependencies, and the CMS service. */
export const cms = ({
  acknowledgement = "durable",
  cmsOptions,
  compileOptions,
  definitionSnapshot,
  operationContracts,
  root,
}: Options): Layer.Layer<CmsService, InfrastructureFailure> => {
  let layerOptions: CmsLayerOptions = { ...cmsOptions };
  if (operationContracts !== undefined) {
    layerOptions = { ...layerOptions, operationContracts };
  }
  const persistenceLayer = filesystemPersistenceLayer({
    acknowledgement,
    compileOptions,
    definitionSnapshot,
    root,
  }).pipe(Layer.provide(developmentDependenciesLayer));

  return makeCmsLayer(layerOptions).pipe(
    Layer.provide(Layer.mergeAll(developmentDependenciesLayer, persistenceLayer)),
  );
};
