import { Effect } from "effect";
import type { Asset as AssetValue, IngestInput, StoredAsset } from "./asset.ts";
import { AssetReferenced, type CmsError } from "./cms-error.ts";
import cmsSupport from "./cms-support.ts";
import type { CmsServiceOperationContext } from "./cms-service-operation-context.ts";

const { collectReferences, liveRecords } = cmsSupport,

 deleteAssetOperation =
  (context: CmsServiceOperationContext) =>
  (assetId: string): Effect.Effect<void, CmsError> =>
    Effect.gen(function* deleteAssetOperationEffect() {
      const snapshot = yield* context.currentDefinitionSnapshot;
      yield* context.authorize("asset.delete", {
        assetId,
        definitionSpaceId: snapshot.definitionSpaceId,
        kind: "asset",
      });
      const generation = yield* context.persistence.readGeneration;
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
      yield* context.assets.delete(assetId);
    }),

 getAssetOperation =
  (context: CmsServiceOperationContext) =>
  (assetId: string): Effect.Effect<AssetValue, CmsError> =>
    Effect.gen(function* getAssetOperationEffect() {
      const snapshot = yield* context.currentDefinitionSnapshot;
      yield* context.authorize("asset.read", {
        assetId,
        definitionSpaceId: snapshot.definitionSpaceId,
        kind: "asset",
      });
      return yield* context.assets.get(assetId);
    }),

 ingestAssetOperation =
  (context: CmsServiceOperationContext) =>
  (input: IngestInput): Effect.Effect<AssetValue, CmsError> =>
    Effect.gen(function* ingestAssetOperationEffect() {
      const snapshot = yield* context.currentDefinitionSnapshot;
      yield* context.authorize("asset.create", {
        definitionSpaceId: snapshot.definitionSpaceId,
        kind: "asset",
      });
      return yield* context.assets.ingest(input);
    }),

 listAssetsOperation = (context: CmsServiceOperationContext) =>
  Effect.gen(function* listAssets() {
    const snapshot = yield* context.currentDefinitionSnapshot;
    yield* context.authorize("asset.read", {
      definitionSpaceId: snapshot.definitionSpaceId,
      kind: "asset",
    });
    return yield* context.assets.list;
  }),

 readAssetOperation =
  (context: CmsServiceOperationContext) =>
  (assetId: string): Effect.Effect<StoredAsset, CmsError> =>
    Effect.gen(function* readAssetOperationEffect() {
      const snapshot = yield* context.currentDefinitionSnapshot;
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
  readAsset: readAssetOperation,
};
