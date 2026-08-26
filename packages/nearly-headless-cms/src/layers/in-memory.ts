import type { CompileOptions, CompiledSnapshot } from "../content-definition.ts";
import type { Service as CmsService } from "../cms.ts";
import type { DefinitionContract } from "../operation.ts";
import type { Handler } from "../definition-migration.ts";
import type { Layer } from "effect";
import { layer as developmentCmsLayer } from "../testing/development-cms.ts";

/** Options for an entirely in-memory CMS layer. */
export interface Options {
  readonly snapshot: CompiledSnapshot;
  readonly compileOptions?: CompileOptions;
  readonly migrationHandlers?: readonly Handler[];
  readonly operationContracts?: readonly DefinitionContract[];
}

/** Composes every development adapter into one ready-to-use CMS layer. */
export const cms = (options: Options): Layer.Layer<CmsService> => developmentCmsLayer(options);
