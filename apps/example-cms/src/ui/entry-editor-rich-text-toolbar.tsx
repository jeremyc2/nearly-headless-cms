import {
  type BrowserAdapter,
  type RefObject,
  RichTextBlockPicker,
  RichTextMarkButton,
  RichTextToolbarHistoryButtons,
  RichTextToolbarListButtons,
  preserveSelection,
} from "./entry-editor-rich-text-toolbar-imports.ts";

export const EntryEditorRichTextToolbar = ({
  adapter,
  onOpenAssetDialog,
  onOpenEntryDialog,
  onOpenLinkDialog,
  toolbar,
}: {
  readonly adapter: RefObject<BrowserAdapter | null>;
  readonly onOpenAssetDialog: () => void;
  readonly onOpenEntryDialog: () => void;
  readonly onOpenLinkDialog: () => void;
  readonly toolbar: RefObject<HTMLDivElement | null>;
}) => (
  <div
    aria-label="Rich Text formatting"
    className="rich-toolbar"
    ref={toolbar}
    role="toolbar"
  >
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
