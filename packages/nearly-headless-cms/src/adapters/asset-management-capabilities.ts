import { Effect, Layer } from "effect";
import { Catalog, Management, Transfer } from "../asset.ts";
import { InfrastructureFailure, InvalidInput } from "../cms-error.ts";

const catalogFromManagement = (management: typeof Management.Service): typeof Catalog.Service =>
    Catalog.of({
      delete: (assetIdentifier) => management.delete(assetIdentifier),
      get: (assetIdentifier) => management.get(assetIdentifier),
      list: (_void: void) => management.list(),
    }),
  transferFromManagement = (
    management: typeof Management.Service,
  ): typeof Transfer.Service =>
    Transfer.of({
      prepareDownload: (assetIdentifier) =>
        management.read(assetIdentifier).pipe(
          Effect.map((asset) => ({ ...asset, kind: "direct-stream" as const })),
        ),
      prepareUpload: (metadata) =>
        Effect.succeed({
          ingest: ({ content }) => management.ingest({ ...metadata, content }),
          kind: "direct-stream" as const,
        }),
    }),
  catalogLayer = Layer.effect(
    Catalog,
    Management.pipe(Effect.map(catalogFromManagement)),
  ),
  transferLayer = Layer.effect(
    Transfer,
    Management.pipe(Effect.map(transferFromManagement)),
  ),
  /** Derives independent metadata and transfer capabilities from legacy Asset Management. */
  fromAssetManagement: Layer.Layer<Catalog | Transfer, never, Management> = Layer.merge(
    catalogLayer,
    transferLayer,
  ),
  managementFromCapabilities =
    (transfer: typeof Transfer.Service) =>
    (catalog: typeof Catalog.Service): typeof Management.Service =>
      Management.of({
        delete: (assetIdentifier) => catalog.delete(assetIdentifier),
        get: (assetIdentifier) => catalog.get(assetIdentifier),
        ingest: (input) =>
          transfer.prepareUpload(input).pipe(
            Effect.flatMap((target) => {
              if (target.kind === "direct-stream") {
                return target.ingest({ content: input.content });
              }
              return InvalidInput.make({
                message: "Presigned uploads must use the Asset Transfer capability",
              });
            }),
          ),
        list: (_void: void) => catalog.list(),
        read: (assetIdentifier) =>
          transfer.prepareDownload(assetIdentifier).pipe(
            Effect.flatMap((target) => {
              if (target.kind === "direct-stream") {
                return Effect.succeed(target);
              }
              return InfrastructureFailure.make({
                message: "Redirect downloads must use the Asset Transfer capability",
                retryable: false,
              });
            }),
          ),
      }),
  /** Derives the legacy Asset Management seam from metadata and transfer capabilities. */
  toAssetManagement: Layer.Layer<Management, never, Catalog | Transfer> = Layer.effect(
    Management,
    Effect.gen(function* makeAssetManagementCompatibility() {
      const catalog = yield* Catalog,
        transfer = yield* Transfer;
      return managementFromCapabilities(transfer)(catalog);
    }),
  );

export {
  catalogFromManagement,
  fromAssetManagement,
  managementFromCapabilities,
  toAssetManagement,
  transferFromManagement,
};
