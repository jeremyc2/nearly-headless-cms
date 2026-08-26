import {
  type AssetRepresentation,
  type UseMutationResult,
  type UseQueryResult,
  assetDimensions,
} from "./assets-page-imports.ts";
import assetsPageDialogsSupport from "./assets-page-dialogs-support.tsx";

const { AssetsPageDeleteDialog, AssetsPageReplaceDialog } = assetsPageDialogsSupport,
  AssetsPageAssetCard = <
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-201] React panel helpers preserve local prop aliases for component call sites.
    Asset extends AssetRepresentation,
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-201] React panel helpers preserve local prop aliases for component call sites.
    DeleteImage extends UseMutationResult<unknown, Error, string>,
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-201] React panel helpers preserve local prop aliases for component call sites.
    Replace extends UseMutationResult<
      unknown,
      Error,
      { readonly assetId: string; readonly file: File }
    >,
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-201] React panel helpers preserve local prop aliases for component call sites.
    SetDeletionAssetId extends (assetId: string | undefined) => void,
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-201] React panel helpers preserve local prop aliases for component call sites.
    SetReplacementConfirmationAssetId extends (assetId: string | undefined) => void,
  >({
    asset,
    deleteImage,
    replace,
    setDeletionAssetId,
    setReplacementConfirmationAssetId,
  }: {
    readonly asset: Readonly<Asset>;
    readonly deleteImage: DeleteImage;
    readonly replace: Replace;
    readonly setDeletionAssetId: SetDeletionAssetId;
    readonly setReplacementConfirmationAssetId: SetReplacementConfirmationAssetId;
  }) => (
    <article className="asset-card">
      <AssetsPageAssetPreview asset={asset} />
      <strong>{asset.metadata.filename}</strong>
      <small>
        {asset.metadata.mediaType} · {asset.metadata.byteLength.toLocaleString()} bytes
        {assetDimensions(asset.metadata.width, asset.metadata.height)}
      </small>
      <AssetsPageAssetCardActions
        asset={asset}
        deleteImage={deleteImage}
        replace={replace}
        setDeletionAssetId={setDeletionAssetId}
        setReplacementConfirmationAssetId={setReplacementConfirmationAssetId}
      />
    </article>
  ),
  // oxlint-disable-next-line eslint/max-lines-per-function -- [EH-169] React panel helpers exceed function line budget after typed prop alias escape hatches.
  AssetsPageAssetCardActions = <
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-201] React panel helpers preserve local prop aliases for component call sites.
    Asset extends AssetRepresentation,
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-201] React panel helpers preserve local prop aliases for component call sites.
    DeleteImage extends UseMutationResult<unknown, Error, string>,
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-201] React panel helpers preserve local prop aliases for component call sites.
    Replace extends UseMutationResult<
      unknown,
      Error,
      { readonly assetId: string; readonly file: File }
    >,
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-201] React panel helpers preserve local prop aliases for component call sites.
    SetDeletionAssetId extends (assetId: string | undefined) => void,
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-201] React panel helpers preserve local prop aliases for component call sites.
    SetReplacementConfirmationAssetId extends (assetId: string | undefined) => void,
  >({
    asset,
    deleteImage,
    replace,
    setDeletionAssetId,
    setReplacementConfirmationAssetId,
  }: {
    readonly asset: Readonly<Asset>;
    readonly deleteImage: DeleteImage;
    readonly replace: Replace;
    readonly setDeletionAssetId: SetDeletionAssetId;
    readonly setReplacementConfirmationAssetId: SetReplacementConfirmationAssetId;
  }) => (
    <div className="asset-actions">
      <button
        className="secondary-button"
        type="button"
        disabled={replace.isPending || deleteImage.isPending}
        onClick={() => {
          setReplacementConfirmationAssetId(asset.id);
        }}
      >
        Replace…
      </button>
      <button
        className="danger-button"
        type="button"
        disabled={replace.isPending || deleteImage.isPending}
        onClick={() => {
          setDeletionAssetId(asset.id);
        }}
      >
        Delete…
      </button>
    </div>
  ),
  AssetsPageAssetPreview = <Asset extends AssetRepresentation>({
    asset,
  }: {
    readonly asset: Readonly<Asset>;
  }) => (
    <div className="asset-preview">
      {asset.metadata.mediaType.startsWith("image/") && (
        <img
          src={`/api/v1/management/definition-spaces/example-blog/assets/${encodeURIComponent(asset.id)}/content`}
          alt={asset.metadata.defaultAlternativeText ?? asset.metadata.filename}
        />
      )}
      {!asset.metadata.mediaType.startsWith("image/") && <span aria-hidden="true">◫</span>}
    </div>
  ),
  AssetsPageGrid = <
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-201] React panel helpers preserve local prop aliases for component call sites.
    Assets extends UseQueryResult<readonly AssetRepresentation[]>,
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-201] React panel helpers preserve local prop aliases for component call sites.
    DeleteImage extends UseMutationResult<unknown, Error, string>,
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-201] React panel helpers preserve local prop aliases for component call sites.
    Replace extends UseMutationResult<
      unknown,
      Error,
      { readonly assetId: string; readonly file: File }
    >,
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-201] React panel helpers preserve local prop aliases for component call sites.
    SetDeletionAssetId extends (assetId: string | undefined) => void,
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-201] React panel helpers preserve local prop aliases for component call sites.
    SetReplacementConfirmationAssetId extends (assetId: string | undefined) => void,
  >({
    assets,
    chooseFile,
    deleteImage,
    replace,
    setDeletionAssetId,
    setReplacementConfirmationAssetId,
  }: {
    readonly assets: Assets;
    readonly chooseFile: () => void;
    readonly deleteImage: DeleteImage;
    readonly replace: Replace;
    readonly setDeletionAssetId: SetDeletionAssetId;
    readonly setReplacementConfirmationAssetId: SetReplacementConfirmationAssetId;
  }) => (
    <section className="asset-grid">
      {assets.data?.map((asset) => (
        <AssetsPageAssetCard
          asset={asset}
          deleteImage={deleteImage}
          key={asset.id}
          replace={replace}
          setDeletionAssetId={setDeletionAssetId}
          setReplacementConfirmationAssetId={setReplacementConfirmationAssetId}
        />
      ))}
      <button className="asset-upload" onClick={chooseFile}>
        ＋<span>Upload a new Asset</span>
      </button>
    </section>
  );

export default {
  AssetsPageDeleteDialog,
  AssetsPageGrid,
  AssetsPageReplaceDialog,
};
