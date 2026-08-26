import { RichTextToolbar } from "./entry-editor-rich-text-toolbar-support.tsx";
import type { BrowserAdapter } from "./rich-text-editor/index.ts";
import type { State } from "./rich-text-editor/transactions-types.ts";
import type { RefObject } from "react";

export const EntryEditorRichTextToolbar = <
  // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-201] React panel helpers preserve local prop aliases for component call sites.
  AdapterRef extends RefObject<BrowserAdapter | null>,
  // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-201] React panel helpers preserve local prop aliases for component call sites.
  ToolbarRef extends RefObject<HTMLDivElement | null>,
>({
  adapter,
  editorState,
  onOpenAssetDialog,
  onOpenEntryDialog,
  onOpenLinkDialog,
  toolbar,
}: {
  readonly adapter: Readonly<AdapterRef>;
  readonly editorState: State | undefined;
  readonly onOpenAssetDialog: () => void;
  readonly onOpenEntryDialog: () => void;
  readonly onOpenLinkDialog: () => void;
  readonly toolbar: Readonly<ToolbarRef>;
}) => (
  <RichTextToolbar
    adapter={adapter}
    editorState={editorState}
    onOpenAssetDialog={onOpenAssetDialog}
    onOpenEntryDialog={onOpenEntryDialog}
    onOpenLinkDialog={onOpenLinkDialog}
    toolbar={toolbar}
  />
);
