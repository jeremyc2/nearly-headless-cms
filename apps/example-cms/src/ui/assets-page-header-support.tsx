import { type RefObject, type UseMutationResult } from "./assets-page-imports.ts";
/* oxlint-disable typescript/no-unnecessary-type-parameters -- [EH-139] React panel helpers preserve local prop aliases for component call sites. */

const AssetsPageFileInputs = <
    InputRef extends RefObject<HTMLInputElement | null>,
    ReplacementInputRef extends RefObject<HTMLInputElement | null>,
    ReplaceMutation extends UseMutationResult<
      { readonly reassignedEntryCount: number },
      Error,
      { readonly assetId: string; readonly file: File }
    >,
    UploadMutation extends UseMutationResult<unknown, Error, File>,
  >({
    input,
    replace,
    replacementAssetId,
    replacementInput,
    upload,
  }: {
    readonly input: Readonly<InputRef>;
    readonly replace: ReplaceMutation;
    readonly replacementAssetId: string | undefined;
    readonly replacementInput: Readonly<ReplacementInputRef>;
    readonly upload: UploadMutation;
  }) => (
    <>
      <input
        ref={input}
        className="visually-hidden"
        type="file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file !== undefined) {
            upload.mutate(file);
          }
        }}
      />
      <input
        ref={replacementInput}
        className="visually-hidden"
        type="file"
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file !== undefined && replacementAssetId !== undefined) {
            replace.mutate({ assetId: replacementAssetId, file });
          }
          event.currentTarget.value = "";
        }}
      />
    </>
  ),
  AssetsPageHeader = <
    InputRef extends RefObject<HTMLInputElement | null>,
    ReplacementInputRef extends RefObject<HTMLInputElement | null>,
    ReplaceMutation extends UseMutationResult<
      { readonly reassignedEntryCount: number },
      Error,
      { readonly assetId: string; readonly file: File }
    >,
    UploadMutation extends UseMutationResult<unknown, Error, File>,
  >({
    chooseFile,
    input,
    replace,
    replacementAssetId,
    replacementInput,
    upload,
  }: {
    readonly chooseFile: () => void;
    readonly input: Readonly<InputRef>;
    readonly replace: ReplaceMutation;
    readonly replacementAssetId: string | undefined;
    readonly replacementInput: Readonly<ReplacementInputRef>;
    readonly upload: UploadMutation;
  }) => (
    <header className="page-header">
      <div>
        <p className="eyebrow">Library</p>
        <h1>Assets</h1>
        <p>Immutable files referenced by Entries and Rich Text.</p>
      </div>
      <button className="primary-button" disabled={upload.isPending} onClick={chooseFile}>
        Upload Asset
      </button>
      <AssetsPageFileInputs
        input={input}
        replace={replace}
        replacementAssetId={replacementAssetId}
        replacementInput={replacementInput}
        upload={upload}
      />
    </header>
  ),
  AssetsPageStatus = <
    DeleteMutation extends UseMutationResult<
      {
        readonly clearedAuthorCount: number;
        readonly clearedPostCount: number;
      },
      Error,
      string
    >,
    ReplaceMutation extends UseMutationResult<
      { readonly reassignedEntryCount: number },
      Error,
      { readonly assetId: string; readonly file: File }
    >,
    UploadMutation extends UseMutationResult<unknown, Error, File>,
  >({
    deleteImage,
    replace,
    upload,
  }: {
    readonly deleteImage: DeleteMutation;
    readonly replace: ReplaceMutation;
    readonly upload: UploadMutation;
  }) => (
    <>
      {upload.isSuccess && <p role="status">Asset uploaded successfully.</p>}
      {replace.isSuccess && (
        <p role="status">
          Replacement completed: {replace.data.reassignedEntryCount} Entries reassigned.
        </p>
      )}
      {deleteImage.isSuccess && (
        <p role="status">
          Image deleted after clearing {deleteImage.data.clearedPostCount} Post and{" "}
          {deleteImage.data.clearedAuthorCount} Author assignments.
        </p>
      )}
      {upload.error && (
        <p role="alert" className="error-state">
          {upload.error.message}
        </p>
      )}
      {(replace.error ?? deleteImage.error) !== null &&
        (replace.error ?? deleteImage.error) !== undefined && (
          <p role="alert" className="error-state">
            {(replace.error ?? deleteImage.error)?.message}
          </p>
        )}
    </>
  );

export { AssetsPageHeader, AssetsPageStatus };
