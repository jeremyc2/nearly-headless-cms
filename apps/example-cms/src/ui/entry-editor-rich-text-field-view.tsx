import {
  type BrowserAdapter,
  EntryEditorRichTextInsertDialog,
  EntryEditorRichTextToolbar,
  type RefObject,
  type RichTextInsertDialog,
} from "./entry-editor-rich-text-field-imports.ts";
import type { AssetRepresentation } from "../generated/management-client.ts";

export interface EntryEditorRichTextFieldViewProperties {
  readonly adapter: RefObject<BrowserAdapter | null>;
  readonly assets: readonly AssetRepresentation[] | undefined;
  readonly dialog: RichTextInsertDialog | undefined;
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
  Properties extends EntryEditorRichTextFieldViewProperties,
>({
  adapter,
  assets,
  dialog,
  entryOptions,
  host,
  setDialog,
  surfaceId,
  toolbar,
}: Readonly<Properties>) => (
  <div className="rich-text-shell" id={surfaceId}>
    <EntryEditorRichTextToolbar
      adapter={adapter}
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
