import { AssetReferenced, type CmsError } from "./cms-error.ts";
import type {
  Asset as AssetValue,
  DownloadTarget,
  IngestInput,
  NewAssetMetadata,
  StoredAsset,
  UploadTarget,
} from "./asset.ts";
import type { CmsServiceOperationContext } from "./cms-service-operation-context.ts";
import { Effect } from "effect";
import cmsSupport from "./cms-support.ts";

const { collectReferences, liveRecords } = cmsSupport,
  deleteAssetOperation =
    (context: Readonly<CmsServiceOperationContext>) =>
    (assetId: string): Effect.Effect<void, CmsError> =>
      Effect.gen(function* deleteAssetOperationEffect() {
        const generation = yield* context.persistence.readGeneration(),
          snapshot = yield* context.readCurrentDefinitionSnapshot();
        yield* context.authorize("asset.delete", {
          assetId,
          definitionSpaceId: snapshot.definitionSpaceId,
          kind: "asset",
        });
        for (const record of liveRecords(generation)) {
          const contentType = snapshot.contentTypes.get(record.entry.contentTypeId);
          if (
            contentType !== undefined &&
            collectReferences(contentType, record.entry.values).assetIds.includes(assetId)
          ) {
            return yield* AssetReferenced.make({
              message: "Asset deletion is blocked by a live Entry reference",
            });
          }
        }
        return yield* context.assets.delete(assetId);
      }),
  getAssetOperation =
    (context: Readonly<CmsServiceOperationContext>) =>
    (assetId: string): Effect.Effect<AssetValue, CmsError> =>
      Effect.gen(function* getAssetOperationEffect() {
        const snapshot = yield* context.readCurrentDefinitionSnapshot();
        yield* context.authorize("asset.read", {
          assetId,
          definitionSpaceId: snapshot.definitionSpaceId,
          kind: "asset",
        });
        return yield* context.assets.get(assetId);
      }),
  ingestAssetOperation =
    <Context extends CmsServiceOperationContext>(context: Readonly<Context>) =>
    <Input extends IngestInput>(input: Readonly<Input>): Effect.Effect<AssetValue, CmsError> =>
      Effect.gen(function* ingestAssetOperationEffect() {
        const snapshot = yield* context.readCurrentDefinitionSnapshot();
        yield* context.authorize("asset.create", {
          definitionSpaceId: snapshot.definitionSpaceId,
          kind: "asset",
        });
        return yield* context.assets.ingest(input);
      }),
  listAssetsOperation = (context: Readonly<CmsServiceOperationContext>) =>
    Effect.gen(function* listAssets() {
      const snapshot = yield* context.readCurrentDefinitionSnapshot();
      yield* context.authorize("asset.read", {
        definitionSpaceId: snapshot.definitionSpaceId,
        kind: "asset",
      });
      return yield* context.assets.list();
    }),
  prepareAssetDownloadOperation =
    (context: Readonly<CmsServiceOperationContext>) =>
    (assetId: string): Effect.Effect<DownloadTarget, CmsError> =>
      Effect.gen(function* prepareAssetDownloadOperationEffect() {
        const snapshot = yield* context.readCurrentDefinitionSnapshot();
        yield* context.authorize("asset.read", {
          assetId,
          definitionSpaceId: snapshot.definitionSpaceId,
          kind: "asset",
        });
        return yield* context.assetTransfer.prepareDownload(assetId);
      }),
  prepareAssetUploadOperation =
    (context: Readonly<CmsServiceOperationContext>) =>
    (metadata: Readonly<NewAssetMetadata>): Effect.Effect<UploadTarget, CmsError> =>
      Effect.gen(function* prepareAssetUploadOperationEffect() {
        const snapshot = yield* context.readCurrentDefinitionSnapshot();
        yield* context.authorize("asset.create", {
          definitionSpaceId: snapshot.definitionSpaceId,
          kind: "asset",
        });
        return yield* context.assetTransfer.prepareUpload(metadata);
      }),
  readAssetOperation =
    (context: Readonly<CmsServiceOperationContext>) =>
    (assetId: string): Effect.Effect<StoredAsset, CmsError> =>
      Effect.gen(function* readAssetOperationEffect() {
        const snapshot = yield* context.readCurrentDefinitionSnapshot();
        yield* context.authorize("asset.read", {
          assetId,
          definitionSpaceId: snapshot.definitionSpaceId,
          kind: "asset",
        });
        return yield* context.assets.read(assetId);
      });

export default {
  deleteAsset: deleteAssetOperation,
  getAsset: getAssetOperation,
  ingestAsset: ingestAssetOperation,
  listAssets: listAssetsOperation,
  prepareAssetDownload: prepareAssetDownloadOperation,
  prepareAssetUpload: prepareAssetUploadOperation,
  readAsset: readAssetOperation,
};
