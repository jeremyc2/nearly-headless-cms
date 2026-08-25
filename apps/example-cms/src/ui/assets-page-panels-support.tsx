import {
  type AssetRepresentation,
  type RefObject,
  type UseMutationResult,
  type UseQueryResult,
  assetDimensions,
  deleteImageLabel,
} from "./assets-page-imports.ts";

const AssetsPageAssetCard = ({
    asset,
    deleteImage,
    replace,
    setDeletionAssetId,
    setReplacementConfirmationAssetId,
  }: {
    readonly asset: AssetRepresentation;
    readonly deleteImage: UseMutationResult<unknown, Error, string>;
    readonly replace: UseMutationResult<unknown, Error, { readonly assetId: string; readonly file: File }>;
    readonly setDeletionAssetId: (assetId: string | undefined) => void;
    readonly setReplacementConfirmationAssetId: (assetId: string | undefined) => void;
  }) => (
    <article className="asset-card">
      <AssetsPageAssetPreview asset={asset} />
      <strong>{asset.metadata.filename}</strong>
      <small>
        {asset.metadata.mediaType} · {asset.metadata.byteLength.toLocaleString()} bytes
        {assetDimensions(asset.metadata.width, asset.metadata.height)}
      </small>
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
    </article>
  ),
  AssetsPageAssetPreview = ({ asset }: { readonly asset: AssetRepresentation }) => (
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
  AssetsPageDeleteDialog = ({
    deleteImage,
    deletionAssetId,
    setDeletionAssetId,
  }: {
    readonly deleteImage: UseMutationResult<
      {
        readonly clearedAuthorCount: number;
        readonly clearedPostCount: number;
      },
      Error,
      string
    >;
    readonly deletionAssetId: string;
    readonly setDeletionAssetId: (assetId: string | undefined) => void;
  }) => (
    <AssetsPageDestructiveDialog eyebrow="Confirm deletion" title="Delete this image Asset?" titleId="delete-image-title">
      <p>
        Optional featured-image and portrait assignments will be cleared automatically. Rich Text
        references still block deletion so authored content is never silently removed.
      </p>
      <div className="editor-actions">
        <button
          className="secondary-button"
          type="button"
          onClick={() => {
            setDeletionAssetId(undefined);
          }}
        >
          Cancel
        </button>
        <button
          className="danger-button"
          type="button"
          disabled={deleteImage.isPending}
          onClick={() => {
            deleteImage.mutate(deletionAssetId);
          }}
        >
          {deleteImageLabel(deleteImage.isPending)}
        </button>
      </div>
    </AssetsPageDestructiveDialog>
  ),
  AssetsPageDestructiveDialog = ({
    children,
    eyebrow,
    title,
    titleId,
  }: {
    readonly children: React.ReactNode;
    readonly eyebrow: string;
    readonly title: string;
    readonly titleId: string;
  }) => (
    <div className="rich-dialog-backdrop">
      <div
        className="rich-dialog destructive-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <p className="eyebrow">{eyebrow}</p>
        <h2 id={titleId}>{title}</h2>
        {children}
      </div>
    </div>
  ),
  AssetsPageGrid = ({
    assets,
    chooseFile,
    deleteImage,
    replace,
    setDeletionAssetId,
    setReplacementConfirmationAssetId,
  }: {
    readonly assets: UseQueryResult<readonly AssetRepresentation[]>;
    readonly chooseFile: () => void;
    readonly deleteImage: UseMutationResult<unknown, Error, string>;
    readonly replace: UseMutationResult<unknown, Error, { readonly assetId: string; readonly file: File }>;
    readonly setDeletionAssetId: (assetId: string | undefined) => void;
    readonly setReplacementConfirmationAssetId: (assetId: string | undefined) => void;
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
  ),
  AssetsPageReplaceDialog = ({
    replacementConfirmationAssetId,
    replacementInput,
    setReplacementAssetId,
    setReplacementConfirmationAssetId,
  }: {
    readonly replacementConfirmationAssetId: string;
    readonly replacementInput: RefObject<HTMLInputElement | null>;
    readonly setReplacementAssetId: (assetId: string | undefined) => void;
    readonly setReplacementConfirmationAssetId: (assetId: string | undefined) => void;
  }) => (
    <AssetsPageDestructiveDialog
      eyebrow="Confirm replacement"
      title="Replace this immutable image?"
      titleId="replace-image-title"
    >
      <p>
        A new Asset will be ingested, every direct and Rich Text reference will be reassigned
        atomically, and the old Asset will be deleted last.
      </p>
      <div className="editor-actions">
        <button
          className="secondary-button"
          type="button"
          onClick={() => {
            setReplacementConfirmationAssetId(undefined);
          }}
        >
          Cancel
        </button>
        <button
          className="primary-button"
          type="button"
          onClick={() => {
            setReplacementAssetId(replacementConfirmationAssetId);
            setReplacementConfirmationAssetId(undefined);
            queueMicrotask(() => replacementInput.current?.click());
          }}
        >
          Choose replacement file
        </button>
      </div>
    </AssetsPageDestructiveDialog>
  );

export default {
  AssetsPageDeleteDialog,
  AssetsPageGrid,
  AssetsPageReplaceDialog,
};
