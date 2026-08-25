import { type RefObject, type UseMutationResult, deleteImageLabel } from "./assets-page-imports.ts";

const AssetsPageDeleteDialog = <
    DeleteImage extends UseMutationResult<
      {
        readonly clearedAuthorCount: number;
        readonly clearedPostCount: number;
      },
      Error,
      string
    >,
    SetDeletionAssetId extends (assetId: string | undefined) => void,
  >({
    deleteImage,
    deletionAssetId,
    setDeletionAssetId,
  }: {
    readonly deleteImage: Readonly<DeleteImage>;
    readonly deletionAssetId: string;
    readonly setDeletionAssetId: Readonly<SetDeletionAssetId>;
  }) => (
    <AssetsPageDestructiveDialog
      eyebrow="Confirm deletion"
      title="Delete this image Asset?"
      titleId="delete-image-title"
    >
      <p>
        Optional featured-image and portrait assignments will be cleared automatically. Rich Text
        references still block deletion so authored content is never silently removed.
      </p>
      <AssetsPageDeleteDialogActions
        deleteImage={deleteImage}
        deletionAssetId={deletionAssetId}
        setDeletionAssetId={setDeletionAssetId}
      />
    </AssetsPageDestructiveDialog>
  ),
  AssetsPageDeleteDialogActions = <
    DeleteImage extends UseMutationResult<
      {
        readonly clearedAuthorCount: number;
        readonly clearedPostCount: number;
      },
      Error,
      string
    >,
    SetDeletionAssetId extends (assetId: string | undefined) => void,
  >({
    deleteImage,
    deletionAssetId,
    setDeletionAssetId,
  }: {
    readonly deleteImage: Readonly<DeleteImage>;
    readonly deletionAssetId: string;
    readonly setDeletionAssetId: Readonly<SetDeletionAssetId>;
  }) => (
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
  ),
  AssetsPageDestructiveDialog = <Children extends React.ReactNode>({
    children,
    eyebrow,
    title,
    titleId,
  }: {
    readonly children: Readonly<Children>;
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
  AssetsPageReplaceDialog = <
    ReplacementInput extends RefObject<HTMLInputElement | null>,
    SetReplacementAssetId extends (assetId: string | undefined) => void,
    SetReplacementConfirmationAssetId extends (assetId: string | undefined) => void,
  >({
    replacementConfirmationAssetId,
    replacementInput,
    setReplacementAssetId,
    setReplacementConfirmationAssetId,
  }: {
    readonly replacementConfirmationAssetId: string;
    readonly replacementInput: Readonly<ReplacementInput>;
    readonly setReplacementAssetId: Readonly<SetReplacementAssetId>;
    readonly setReplacementConfirmationAssetId: Readonly<SetReplacementConfirmationAssetId>;
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
  AssetsPageReplaceDialog,
};
