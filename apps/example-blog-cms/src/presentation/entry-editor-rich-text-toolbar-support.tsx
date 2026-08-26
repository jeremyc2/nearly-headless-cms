import type { ReactNode, RefObject } from "react";
import type { BrowserAdapter } from "./rich-text-editor/index.ts";
import type { State } from "./rich-text-editor/transactions-types.ts";
import type { RichText } from "nearly-headless-cms";
import transactionsMarks from "./rich-text-editor/transactions-marks.ts";
import { selectedText } from "./rich-text-editor/transactions-selection.ts";
import { headingLevel } from "./main-labels.ts";
import { preserveSelection } from "./main-shared.ts";

const { marksForNextInput } = transactionsMarks,
  toolbarBlockValue = (state: State): string => {
    const block = state.document.children[state.selection.anchor.blockIndex];
    if (block?.type === "heading") {
      return `heading-${block.level}`;
    }
    if (block?.type === "quote") {
      return "quote";
    }
    if (block?.type === "code-block") {
      return "code-block";
    }
    return "paragraph";
  },
  toolbarCanRedo = (state: State): boolean => state.historyIndex < state.history.length - 1,
  toolbarCanUndo = (state: State): boolean => state.historyIndex > 0,
  toolbarMarkActive = (state: State, mark: RichText.Mark): boolean => {
    const selected = selectedText(state);
    if (selected !== undefined && selected.start !== selected.end) {
      return selected.text.marks?.includes(mark) ?? false;
    }
    return marksForNextInput(state).includes(mark);
  },
  RichTextBlockPicker = <Adapter extends RefObject<BrowserAdapter | null>>({
    adapter,
    editorState,
  }: {
    readonly adapter: Readonly<Adapter>;
    readonly editorState: State | undefined;
  }) => (
    <label className="rich-block-picker" onMouseDown={preserveSelection}>
      <span className="visually-hidden">Block type</span>
      <select
        aria-label="Block type"
        onChange={(event) => {
          dispatchBlockKind(adapter, event.target.value);
        }}
        value={editorState === undefined ? "paragraph" : toolbarBlockValue(editorState)}
      >
        <option value="paragraph">Paragraph</option>
        <option value="heading-2">Heading 2</option>
        <option value="heading-3">Heading 3</option>
        <option value="heading-4">Heading 4</option>
        <option value="quote">Quote</option>
        <option value="code-block">Code block</option>
      </select>
    </label>
  ),
  RichTextMarkButton = <
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-201] React panel helpers preserve local prop aliases for component call sites.
    Adapter extends RefObject<BrowserAdapter | null>,
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-201] React panel helpers preserve local prop aliases for component call sites.
    Mark extends "bold" | "code" | "italic" | "strikethrough",
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-201] React panel helpers preserve local prop aliases for component call sites.
    Content extends ReactNode,
  >({
    adapter,
    ariaLabel,
    children,
    editorState,
    mark,
  }: {
    readonly adapter: Readonly<Adapter>;
    readonly ariaLabel: string;
    readonly children: Content;
    readonly editorState: State | undefined;
    readonly mark: Mark;
  }) => (
    <button
      aria-label={ariaLabel}
      aria-pressed={editorState === undefined ? false : toolbarMarkActive(editorState, mark)}
      className="rich-toolbar-mark-button"
      onClick={() => adapter.current?.dispatchToolbarCommand({ mark, type: "toggleMark" })}
      onMouseDown={preserveSelection}
      type="button"
    >
      {children}
    </button>
  ),
  RichTextToolbarHistoryButtons = <Adapter extends RefObject<BrowserAdapter | null>>({
    adapter,
    editorState,
  }: {
    readonly adapter: Readonly<Adapter>;
    readonly editorState: State | undefined;
  }) => (
    <>
      <button
        disabled={editorState === undefined || !toolbarCanUndo(editorState)}
        onClick={() => adapter.current?.dispatchToolbarCommand({ type: "undo" })}
        onMouseDown={preserveSelection}
        type="button"
      >
        Undo
      </button>
      <button
        disabled={editorState === undefined || !toolbarCanRedo(editorState)}
        onClick={() => adapter.current?.dispatchToolbarCommand({ type: "redo" })}
        onMouseDown={preserveSelection}
        type="button"
      >
        Redo
      </button>
    </>
  ),
  RichTextToolbarInsertButtons = ({
    onOpenAssetDialog,
    onOpenEntryDialog,
    onOpenLinkDialog,
  }: {
    readonly onOpenAssetDialog: () => void;
    readonly onOpenEntryDialog: () => void;
    readonly onOpenLinkDialog: () => void;
  }) => (
    <>
      <button onClick={onOpenLinkDialog} onMouseDown={preserveSelection} type="button">
        Link
      </button>
      <button onClick={onOpenEntryDialog} onMouseDown={preserveSelection} type="button">
        Entry reference
      </button>
      <button onClick={onOpenAssetDialog} onMouseDown={preserveSelection} type="button">
        Asset
      </button>
    </>
  ),
  RichTextToolbarListButtons = <Adapter extends RefObject<BrowserAdapter | null>>({
    adapter,
  }: {
    readonly adapter: Readonly<Adapter>;
  }) => (
    <>
      <button
        aria-label="Unordered list"
        onClick={() =>
          adapter.current?.dispatchToolbarCommand({
            listType: "unordered-list",
            type: "toggleList",
          })
        }
        onMouseDown={preserveSelection}
        type="button"
      >
        • List
      </button>
      <button
        aria-label="Ordered list"
        onClick={() =>
          adapter.current?.dispatchToolbarCommand({ listType: "ordered-list", type: "toggleList" })
        }
        onMouseDown={preserveSelection}
        type="button"
      >
        1. List
      </button>
    </>
  ),
  RichTextToolbarMarkButtons = <Adapter extends RefObject<BrowserAdapter | null>>({
    adapter,
    editorState,
  }: {
    readonly adapter: Readonly<Adapter>;
    readonly editorState: State | undefined;
  }) => (
    <>
      <RichTextMarkButton adapter={adapter} ariaLabel="Bold" editorState={editorState} mark="bold">
        <span className="rich-toolbar-mark rich-toolbar-mark-bold">B</span>
      </RichTextMarkButton>
      <RichTextMarkButton
        adapter={adapter}
        ariaLabel="Italic"
        editorState={editorState}
        mark="italic"
      >
        <span className="rich-toolbar-mark rich-toolbar-mark-italic">I</span>
      </RichTextMarkButton>
      <RichTextMarkButton
        adapter={adapter}
        ariaLabel="Strikethrough"
        editorState={editorState}
        mark="strikethrough"
      >
        <span className="rich-toolbar-mark rich-toolbar-mark-strikethrough">S</span>
      </RichTextMarkButton>
      <RichTextMarkButton adapter={adapter} ariaLabel="Inline code" editorState={editorState} mark="code">
        <span className="rich-toolbar-mark rich-toolbar-mark-code">{"</>"}</span>
      </RichTextMarkButton>
    </>
  ),
  RichTextToolbar = <
    Adapter extends RefObject<BrowserAdapter | null>,
    Toolbar extends RefObject<HTMLDivElement | null>,
  >({
    adapter,
    editorState,
    onOpenAssetDialog,
    onOpenEntryDialog,
    onOpenLinkDialog,
    toolbar,
  }: {
    readonly adapter: Readonly<Adapter>;
    readonly editorState: State | undefined;
    readonly onOpenAssetDialog: () => void;
    readonly onOpenEntryDialog: () => void;
    readonly onOpenLinkDialog: () => void;
    readonly toolbar: Readonly<Toolbar>;
  }) => (
    <div aria-label="Rich Text formatting" className="rich-toolbar" ref={toolbar} role="toolbar">
      <div className="rich-toolbar-group">
        <RichTextBlockPicker adapter={adapter} editorState={editorState} />
      </div>
      <span aria-hidden="true" className="rich-toolbar-divider" />
      <div className="rich-toolbar-group">
        <RichTextToolbarMarkButtons adapter={adapter} editorState={editorState} />
      </div>
      <span aria-hidden="true" className="rich-toolbar-divider" />
      <div className="rich-toolbar-group">
        <RichTextToolbarListButtons adapter={adapter} />
      </div>
      <span aria-hidden="true" className="rich-toolbar-divider" />
      <div className="rich-toolbar-group">
        <RichTextToolbarInsertButtons
          onOpenAssetDialog={onOpenAssetDialog}
          onOpenEntryDialog={onOpenEntryDialog}
          onOpenLinkDialog={onOpenLinkDialog}
        />
      </div>
      <span aria-hidden="true" className="rich-toolbar-divider" />
      <div className="rich-toolbar-group">
        <RichTextToolbarHistoryButtons adapter={adapter} editorState={editorState} />
      </div>
    </div>
  ),
  // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-201] React panel helpers preserve local prop aliases for component call sites.
  dispatchBlockKind = <Adapter extends RefObject<BrowserAdapter | null>>(
    adapter: Adapter,
    blockType: string,
  ): void => {
    if (blockType === "heading-2" || blockType === "heading-3" || blockType === "heading-4") {
      adapter.current?.dispatchToolbarCommand({
        blockType: "heading",
        headingLevel: headingLevel(blockType),
        type: "setBlockKind",
      });
      return;
    }
    if (blockType === "paragraph" || blockType === "quote" || blockType === "code-block") {
      adapter.current?.dispatchToolbarCommand({ blockType, type: "setBlockKind" });
    }
  };

export { RichTextToolbar };
