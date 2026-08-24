import type { ReactNode, RefObject } from "react";
import type { BrowserAdapter } from "./rich-text-editor/index.ts";
import { headingLevel } from "./main-labels.ts";
import { preserveSelection } from "./main-shared.ts";

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
    <label className="rich-block-picker">
      <span className="visually-hidden">Block type</span>
      <select
        aria-label="Block type"
        defaultValue="paragraph"
        onChange={(event) => {
          dispatchBlockKind(adapter, event.target.value);
        }}
      >
        <option value="paragraph">Paragraph</option>
        <option value="heading-2">Heading 2</option>
        <option value="heading-3">Heading 3</option>
        <option value="heading-4">Heading 4</option>
        <option value="quote">Quote</option>
        <option value="code-block">Code block</option>
      </select>
    </label>
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
),

RichTextMarkButton = ({
  adapter,
  ariaLabel,
  children,
  mark,
}: {
  readonly adapter: RefObject<BrowserAdapter | null>;
  readonly ariaLabel: string;
  readonly children: ReactNode;
  readonly mark: "bold" | "code" | "italic" | "strikethrough";
}) => (
  <button
    aria-label={ariaLabel}
    onClick={() => adapter.current?.dispatch({ mark, type: "toggleMark" })}
    onMouseDown={preserveSelection}
    type="button"
  >
    {children}
  </button>
),

RichTextToolbarListButtons = ({
  adapter,
}: {
  readonly adapter: RefObject<BrowserAdapter | null>;
}) => (
  <>
    <button
      aria-label="Unordered list"
      onClick={() => adapter.current?.dispatch({ listType: "unordered-list", type: "toggleList" })}
      onMouseDown={preserveSelection}
      type="button"
    >
      • List
    </button>
    <button
      aria-label="Ordered list"
      onClick={() => adapter.current?.dispatch({ listType: "ordered-list", type: "toggleList" })}
      onMouseDown={preserveSelection}
      type="button"
    >
      1. List
    </button>
  </>
),

RichTextToolbarHistoryButtons = ({
  adapter,
}: {
  readonly adapter: RefObject<BrowserAdapter | null>;
}) => (
  <>
    <button
      onClick={() => adapter.current?.dispatch({ type: "undo" })}
      onMouseDown={preserveSelection}
      type="button"
    >
      Undo
    </button>
    <button
      onClick={() => adapter.current?.dispatch({ type: "redo" })}
      onMouseDown={preserveSelection}
      type="button"
    >
      Redo
    </button>
  </>
);

function dispatchBlockKind(
  adapter: RefObject<BrowserAdapter | null>,
  blockType: string,
): void {
  if (blockType === "heading-2" || blockType === "heading-3" || blockType === "heading-4") {
    adapter.current?.dispatch({
      blockType: "heading",
      headingLevel: headingLevel(blockType),
      type: "setBlockKind",
    });
    return;
  }
  if (blockType === "paragraph" || blockType === "quote" || blockType === "code-block") {
    adapter.current?.dispatch({ blockType, type: "setBlockKind" });
  }
}
