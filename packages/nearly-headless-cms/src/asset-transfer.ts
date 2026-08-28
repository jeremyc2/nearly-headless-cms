import type { InfrastructureFailure, InvalidInput, NotFound } from "./cms-error.ts";
import { Context, type Effect } from "effect";
import type {
  DownloadTarget,
  NewAssetMetadata,
  UploadTarget,
} from "./asset-capability-types.ts";

/** Builder-supplied Asset transfer intent capability. */
export class Transfer extends Context.Service<
  Transfer,
  {
    readonly prepareDownload: (
      assetId: string,
    ) => Effect.Effect<DownloadTarget, NotFound | InfrastructureFailure>;
    readonly prepareUpload: (
      metadata: Readonly<NewAssetMetadata>,
    ) => Effect.Effect<UploadTarget, InvalidInput | InfrastructureFailure>;
  }
>()("nearly-headless-cms/asset-transfer/Transfer") {}
