import {
  type AssetRepresentation,
  type BrowserAdapter,
  type RefObject,
  type RichTextInsertDialog,
  assetCaption,
} from "./entry-editor-rich-text-insert-dialog-imports.ts";

const InsertDialogActions = ({
    adapter,
    closeDialog,
    dialog,
  }: {
    readonly adapter: RefObject<BrowserAdapter | null>;
    readonly closeDialog: () => void;
    readonly dialog: RichTextInsertDialog;
  }) => (
    <div className="editor-actions">
      <button className="secondary-button" onClick={closeDialog} type="button">
        Cancel
      </button>
      <button
        className="primary-button"
        disabled={isInsertDisabled(dialog)}
        onClick={() => {
          insertReference(adapter, closeDialog, dialog);
        }}
        type="button"
      >
        Insert
      </button>
    </div>
  ),
  RichTextAssetFields = ({
    assets,
    dialog,
    setDialog,
  }: {
    readonly assets: readonly AssetRepresentation[] | undefined;
    readonly dialog: Extract<RichTextInsertDialog, { readonly type: "asset" }>;
    readonly setDialog: (dialog: RichTextInsertDialog) => void;
  }) => (
    <>
      <label>
        <span>Asset</span>
        <select
          autoFocus
          onChange={(event) => {
            setDialog({ ...dialog, assetId: event.target.value });
          }}
          value={dialog.assetId}
        >
          <option value="">Select an Asset</option>
          {assets?.map((asset) => (
            <option key={asset.id} value={asset.id}>
              {asset.metadata.filename}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Alternative text</span>
        <input
          onChange={(event) => {
            setDialog({ ...dialog, alternativeText: event.target.value });
          }}
          value={dialog.alternativeText}
        />
      </label>
      <label>
        <span>Caption (optional)</span>
        <input
          onChange={(event) => {
            setDialog({ ...dialog, caption: event.target.value });
          }}
          value={dialog.caption}
        />
      </label>
    </>
  ),
  RichTextEntryFields = ({
    dialog,
    entryOptions,
    setDialog,
  }: {
    readonly dialog: Extract<RichTextInsertDialog, { readonly type: "entry" }>;
    readonly entryOptions: readonly {
      readonly identifier: string;
      readonly label: string;
      readonly type: string;
    }[];
    readonly setDialog: (dialog: RichTextInsertDialog) => void;
  }) => (
    <>
      <label>
        <span>Entry ID</span>
        <select
          autoFocus
          onChange={(event) => {
            setDialog({ ...dialog, entryId: event.target.value });
          }}
          value={dialog.entryId}
        >
          <option value="">Select an Entry</option>
          {entryOptions.map((entry) => (
            <option key={entry.identifier} value={entry.identifier}>
              {entry.type} · {entry.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Label for a collapsed selection</span>
        <input
          onChange={(event) => {
            setDialog({ ...dialog, label: event.target.value });
          }}
          value={dialog.label}
        />
      </label>
    </>
  ),
  RichTextLinkFields = ({
    dialog,
    setDialog,
  }: {
    readonly dialog: Extract<RichTextInsertDialog, { readonly type: "link" }>;
    readonly setDialog: (dialog: RichTextInsertDialog) => void;
  }) => (
    <>
      <label>
        <span>URL</span>
        <input
          autoFocus
          onChange={(event) => {
            setDialog({ ...dialog, url: event.target.value });
          }}
          type="url"
          value={dialog.url}
        />
      </label>
      <label>
        <span>Label for a collapsed selection</span>
        <input
          onChange={(event) => {
            setDialog({ ...dialog, label: event.target.value });
          }}
          value={dialog.label}
        />
      </label>
    </>
  ),
  insertReference = (
    adapter: RefObject<BrowserAdapter | null>,
    closeDialog: () => void,
    dialog: RichTextInsertDialog,
  ): void => {
    if (dialog.type === "link") {
      adapter.current?.dispatch({ label: dialog.label, type: "wrapLink", url: dialog.url });
    } else if (dialog.type === "entry") {
      adapter.current?.dispatch({
        entryId: dialog.entryId,
        label: dialog.label,
        type: "insertEntryReference",
      });
    } else {
      adapter.current?.dispatch({
        alternativeText: dialog.alternativeText,
        assetId: dialog.assetId,
        ...assetCaption(dialog.caption),
        type: "insertAssetReference",
      });
    }
    closeDialog();
  },
  isInsertDisabled = (dialog: RichTextInsertDialog): boolean => {
    if (dialog.type === "link") {
      return dialog.url.length === 0;
    }
    if (dialog.type === "entry") {
      return dialog.entryId.length === 0;
    }
    return dialog.assetId.length === 0;
  };

export default {
  InsertDialogActions,
  RichTextAssetFields,
  RichTextEntryFields,
  RichTextLinkFields,
};
