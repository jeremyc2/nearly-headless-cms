import {
  type AssetRepresentation,
  type BrowserAdapter,
  type RefObject,
  type RichTextInsertDialog,
  dialogHeading,
  richTextInsertDialogSupport,
} from "./entry-editor-rich-text-insert-dialog-bindings.ts";
import { closeWhenBackdropClicked } from "./main-shared.ts";

const { InsertDialogActions, RichTextAssetFields, RichTextEntryFields, RichTextLinkFields } =
    richTextInsertDialogSupport,
  closeInsertDialogOnEscape = (closeDialog: () => void, key: string): void => {
    if (key === "Escape") {
      closeDialog();
    }
  },
  RichTextInsertDialogFields = ({
    assets,
    dialog,
    entryOptions,
    setDialog,
  }: {
    readonly assets: readonly AssetRepresentation[] | undefined;
    readonly dialog: RichTextInsertDialog;
    readonly entryOptions: readonly {
      readonly identifier: string;
      readonly label: string;
      readonly type: string;
    }[];
    readonly setDialog: (dialog: RichTextInsertDialog) => void;
  }) => (
    <>
      {dialog.type === "link" && <RichTextLinkFields dialog={dialog} setDialog={setDialog} />}
      {dialog.type === "entry" && (
        <RichTextEntryFields dialog={dialog} entryOptions={entryOptions} setDialog={setDialog} />
      )}
      {dialog.type === "asset" && (
        <RichTextAssetFields assets={assets} dialog={dialog} setDialog={setDialog} />
      )}
    </>
  ),
  EntryEditorRichTextInsertDialog = <
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-201] React panel helpers preserve local prop aliases for component call sites.
    AdapterRef extends RefObject<BrowserAdapter | null>,
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-201] React panel helpers preserve local prop aliases for component call sites.
    Dialog extends RichTextInsertDialog,
  >({
    adapter,
    assets,
    closeDialog,
    dialog,
    entryOptions,
    setDialog,
  }: {
    readonly adapter: Readonly<AdapterRef>;
    readonly assets: readonly AssetRepresentation[] | undefined;
    readonly closeDialog: () => void;
    readonly dialog: Dialog;
    readonly entryOptions: readonly {
      readonly identifier: string;
      readonly label: string;
      readonly type: string;
    }[];
    readonly setDialog: (dialog: RichTextInsertDialog) => void;
  }) => (
    <div
      className="rich-dialog-backdrop"
      onClick={closeWhenBackdropClicked(closeDialog)}
      onKeyDown={(event) => {
        closeInsertDialogOnEscape(closeDialog, event.key);
      }}
    >
      <div
        aria-label={`Insert ${dialogHeading(dialog.type)} reference`}
        aria-modal="true"
        className="rich-dialog"
        role="dialog"
      >
        <h3>Insert {dialogHeading(dialog.type)}</h3>
        <RichTextInsertDialogFields
          assets={assets}
          dialog={dialog}
          entryOptions={entryOptions}
          setDialog={setDialog}
        />
        <InsertDialogActions adapter={adapter} closeDialog={closeDialog} dialog={dialog} />
      </div>
    </div>
  );

export { EntryEditorRichTextInsertDialog };
