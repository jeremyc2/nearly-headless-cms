import type { ReactNode, RefObject } from "react";
import type { BrowserAdapter } from "./rich-text-editor/index.ts";
import { headingLevel } from "./main-labels.ts";
import { preserveSelection } from "./main-shared.ts";

const RichTextBlockPicker = <Adapter extends RefObject<BrowserAdapter | null>>({
    adapter,
  }: {
    readonly adapter: Readonly<Adapter>;
  }) => (
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
    mark,
  }: {
    readonly adapter: Readonly<Adapter>;
    readonly ariaLabel: string;
    readonly children: Content;
    readonly mark: Mark;
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
  RichTextToolbarHistoryButtons = <Adapter extends RefObject<BrowserAdapter | null>>({
    adapter,
  }: {
    readonly adapter: Readonly<Adapter>;
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
          adapter.current?.dispatch({ listType: "unordered-list", type: "toggleList" })
        }
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
  // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-201] React panel helpers preserve local prop aliases for component call sites.
  dispatchBlockKind = <Adapter extends RefObject<BrowserAdapter | null>>(
    adapter: Adapter,
    blockType: string,
  ): void => {
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
  };

export {
  RichTextBlockPicker,
  RichTextMarkButton,
  RichTextToolbarHistoryButtons,
  RichTextToolbarListButtons,
};
