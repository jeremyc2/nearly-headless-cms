import {
  RichTextBlockPicker,
  RichTextMarkButton,
  RichTextToolbarHistoryButtons,
  RichTextToolbarListButtons,
} from "./entry-editor-rich-text-toolbar-support.tsx";
import { preserveSelection } from "./main-shared.ts";
import type { BrowserAdapter } from "./rich-text-editor/index.ts";
import type { RefObject } from "react";

export const EntryEditorRichTextToolbar = <
  // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-201] React panel helpers preserve local prop aliases for component call sites.
  AdapterRef extends RefObject<BrowserAdapter | null>,
  // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-201] React panel helpers preserve local prop aliases for component call sites.
  ToolbarRef extends RefObject<HTMLDivElement | null>,
>({
  adapter,
  onOpenAssetDialog,
  onOpenEntryDialog,
  onOpenLinkDialog,
  toolbar,
}: {
  readonly adapter: Readonly<AdapterRef>;
  readonly onOpenAssetDialog: () => void;
  readonly onOpenEntryDialog: () => void;
  readonly onOpenLinkDialog: () => void;
  readonly toolbar: Readonly<ToolbarRef>;
}) => (
  <div aria-label="Rich Text formatting" className="rich-toolbar" ref={toolbar} role="toolbar">
    <RichTextBlockPicker adapter={adapter} />
    <RichTextMarkButton adapter={adapter} ariaLabel="Bold" mark="bold">
      <strong>B</strong>
    </RichTextMarkButton>
    <RichTextMarkButton adapter={adapter} ariaLabel="Italic" mark="italic">
      <em>I</em>
    </RichTextMarkButton>
    <RichTextMarkButton adapter={adapter} ariaLabel="Strikethrough" mark="strikethrough">
      <s>S</s>
    </RichTextMarkButton>
    <RichTextMarkButton adapter={adapter} ariaLabel="Inline code" mark="code">
      Code
    </RichTextMarkButton>
    <RichTextToolbarListButtons adapter={adapter} />
    <button onClick={onOpenLinkDialog} onMouseDown={preserveSelection} type="button">
      Link
    </button>
    <button onClick={onOpenEntryDialog} onMouseDown={preserveSelection} type="button">
      Entry reference
    </button>
    <button onClick={onOpenAssetDialog} onMouseDown={preserveSelection} type="button">
      Asset
    </button>
    <RichTextToolbarHistoryButtons adapter={adapter} />
  </div>
);
