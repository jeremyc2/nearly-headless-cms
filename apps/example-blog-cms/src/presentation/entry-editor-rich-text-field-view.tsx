import { EntryEditorRichTextInsertDialog } from "./entry-editor-rich-text-insert-dialog.tsx";
import { EntryEditorRichTextToolbar } from "./entry-editor-rich-text-toolbar.tsx";
import type { RefObject } from "react";
import type { BrowserAdapter } from "./rich-text-editor/index.ts";
import type { State } from "./rich-text-editor/transactions-types.ts";
import type { RichTextInsertDialog } from "./entry-editor-types.ts";
import type { AssetRepresentation } from "../generated/management-client.ts";

export interface EntryEditorRichTextFieldViewProperties {
  readonly adapter: RefObject<BrowserAdapter | null>;
  readonly assets: readonly AssetRepresentation[] | undefined;
  readonly dialog: RichTextInsertDialog | undefined;
  readonly editorState: State | undefined;
  readonly entryOptions: readonly {
    readonly identifier: string;
    readonly label: string;
    readonly type: string;
  }[];
  readonly host: RefObject<HTMLDivElement | null>;
  readonly setDialog: (dialog: RichTextInsertDialog | undefined) => void;
  readonly surfaceId: string;
  readonly toolbar: RefObject<HTMLDivElement | null>;
}

export const EntryEditorRichTextFieldView = <
  // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-201] React panel helpers preserve local prop aliases for component call sites.
  Properties extends EntryEditorRichTextFieldViewProperties,
>({
  adapter,
  assets,
  dialog,
  editorState,
  entryOptions,
  host,
  setDialog,
  surfaceId,
  toolbar,
}: Readonly<Properties>) => (
  <div className="rich-text-shell" id={surfaceId}>
    <EntryEditorRichTextToolbar
      adapter={adapter}
      editorState={editorState}
      onOpenAssetDialog={() => {
        setDialog({ alternativeText: "", assetId: "", caption: "", type: "asset" });
      }}
      onOpenEntryDialog={() => {
        setDialog({ entryId: "", label: "", type: "entry" });
      }}
      onOpenLinkDialog={() => {
        setDialog({ label: "", type: "link", url: "" });
      }}
      toolbar={toolbar}
    />
    <div aria-label="Rich Text content" className="rich-surface" ref={host} />
    {dialog !== undefined && (
      <EntryEditorRichTextInsertDialog
        adapter={adapter}
        assets={assets}
        closeDialog={() => {
          setDialog(undefined);
          queueMicrotask(() =>
            toolbar.current?.querySelector<HTMLButtonElement>("button")?.focus(),
          );
        }}
        dialog={dialog}
        entryOptions={entryOptions}
        setDialog={setDialog}
      />
    )}
  </div>
);
