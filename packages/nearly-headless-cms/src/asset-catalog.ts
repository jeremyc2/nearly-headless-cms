import type { AssetReferenced, InfrastructureFailure, NotFound } from "./cms-error.ts";
import { Context, type Effect } from "effect";
import type { Asset } from "./asset.ts";

/** Builder-supplied Asset metadata capability, independent of byte transfer. */
export class Catalog extends Context.Service<
  Catalog,
  {
    readonly delete: (
      assetId: string,
    ) => Effect.Effect<void, NotFound | AssetReferenced | InfrastructureFailure>;
    readonly get: (assetId: string) => Effect.Effect<Asset, NotFound | InfrastructureFailure>;
    readonly list: (_void: void) => Effect.Effect<readonly Asset[], InfrastructureFailure>;
  }
>()("nearly-headless-cms/asset-catalog/Catalog") {}
