import {
  type Command,
  type RichText,
  emptyIndex,
} from "./transactions-editor-adapter-support-imports.ts";
import type {
  ReadonlyClipboardEvent,
  ReadonlyCompositionEvent,
  ReadonlyDragEvent,
  ReadonlyEditableHost,
  ReadonlyHtmlElement,
  ReadonlyInputEvent,
  ReadonlyKeyboardEvent,
} from "./readonly-dom-types.ts";
import transactionsSupport from "./transactions-support.ts";

const { conditionalValue } = transactionsSupport,
  attachBrowserAdapterEventListeners = (
    host: ReadonlyEditableHost,
    handlers: Readonly<BrowserAdapterEventHandlers>,
  ): void => {
    host.addEventListener("beforeinput", handlers.beforeInput);
    host.addEventListener("keydown", handlers.keyDown);
    host.addEventListener("compositionstart", handlers.compositionStart);
    host.addEventListener("compositionend", handlers.compositionEnd);
    host.addEventListener("paste", handlers.paste);
    host.addEventListener("drop", handlers.drop);
  },
  beforeInputCommand = (event: ReadonlyInputEvent): Command | undefined => {
    if (event.inputType === "insertText" && event.data !== null) {
      return { text: event.data, type: "insertText" };
    }
    if (event.inputType === "deleteContentBackward") {
      return { type: "deleteBackward" };
    }
    if (event.inputType === "insertParagraph") {
      return { type: "splitBlock" };
    }
    return undefined;
  },
  blockElementName = <Block extends RichText.BlockNode>(block: Readonly<Block>): string => {
    switch (block.type) {
      case "asset-reference": {
        return "figure";
      }
      case "code-block": {
        return "pre";
      }
      case "heading": {
        return `h${block.level}`;
      }
      case "ordered-list": {
        return "ol";
      }
      case "paragraph": {
        return "p";
      }
      case "quote": {
        return "blockquote";
      }
      case "unordered-list": {
        return "ul";
      }
      default: {
        return "p";
      }
    }
  },
  browserAdapterObserverOptions = {
    characterData: true,
    childList: true,
    subtree: true,
  } as const,
  configureEditableHost = (host: ReadonlyEditableHost): void => {
    host.contentEditable = "true";
    host.setAttribute("role", "textbox");
    host.setAttribute("aria-multiline", "true");
  },
  createRenderingObserver = (
    host: ReadonlyEditableHost,
    shouldRender: () => boolean,
    render: () => void,
  ): MutationObserver => {
    const observer = new MutationObserver(() => {
      if (shouldRender()) {
        render();
      }
    });
    observer.observe(host, browserAdapterObserverOptions);
    return observer;
  },
  detachBrowserAdapterEventListeners = (
    host: ReadonlyEditableHost,
    handlers: Readonly<BrowserAdapterEventHandlers>,
  ): void => {
    host.removeEventListener("beforeinput", handlers.beforeInput);
    host.removeEventListener("keydown", handlers.keyDown);
    host.removeEventListener("compositionstart", handlers.compositionStart);
    host.removeEventListener("compositionend", handlers.compositionEnd);
    host.removeEventListener("paste", handlers.paste);
    host.removeEventListener("drop", handlers.drop);
  },
  listItemSelectorSuffix = (listItemIndex: number | undefined): string => {
    if (listItemIndex === undefined) {
      return "";
    }
    return `[data-list-item-index="${listItemIndex}"]`;
  },
  metaKeyEditorAction = (event: ReadonlyKeyboardEvent): MetaKeyEditorAction | undefined => {
    const key = event.key.toLowerCase();
    if (key === "b") {
      return { command: { mark: "bold", type: "toggleMark" } };
    }
    if (key === "i") {
      return { command: { mark: "italic", type: "toggleMark" } };
    }
    if (key === "k") {
      return { type: "requestLink" };
    }
    if (key === "z") {
      return {
        command: {
          type: conditionalValue(event.shiftKey, "redo" as const, "undo" as const),
        },
      };
    }
    return undefined;
  },
  resolveElementFromNode = <NodeType extends globalThis.Node | null>(
    node: Readonly<NodeType>,
  ): globalThis.Element | null | undefined => {
    if (node === null) {
      return undefined;
    }
    if (node instanceof Element) {
      return node;
    }
    if ("parentElement" in node) {
      return node.parentElement;
    }
    return undefined;
  },
  selectionPositionFromNode = <
    NodeType extends globalThis.Node | null,
    Host extends ReadonlyHtmlElement,
  >(
    node: Readonly<NodeType>,
    offset: number,
    host: Readonly<Host>,
  ): SelectionPosition | undefined => {
    const element = resolveElementFromNode(node),
      text = element?.closest<ReadonlyHtmlElement>("[data-block-index][data-inline-index]");
    if (text === undefined || text === null || !host.contains(text)) {
      return undefined;
    }
    return selectionPositionFromResolvedText(text, offset);
  },
  selectionPositionFromResolvedText = <Text extends ReadonlyHtmlElement>(
    text: Readonly<Text>,
    offset: number,
  ): SelectionPosition => {
    const blockIndex = Number(text.dataset["blockIndex"]),
      boundedOffset = Math.min(offset, textLength(text.textContent)),
      inlineIndex = Number(text.dataset["inlineIndex"]),
      position = { blockIndex, inlineIndex, offset: boundedOffset };
    if (text.dataset["listItemIndex"] === undefined) {
      return position;
    }
    return { ...position, listItemIndex: Number(text.dataset["listItemIndex"]) };
  },
  textLength = (text: string | null | undefined): number => {
    if (text === "\u200B") {
      return emptyIndex;
    }
    return text?.length ?? emptyIndex;
  };

export interface BrowserAdapterEventHandlers {
  readonly beforeInput: <Event extends ReadonlyInputEvent>(event: Readonly<Event>) => void;
  readonly compositionEnd: <Event extends ReadonlyCompositionEvent>(event: Readonly<Event>) => void;
  readonly compositionStart: () => void;
  readonly drop: <Event extends ReadonlyDragEvent>(event: Readonly<Event>) => void;
  readonly keyDown: <Event extends ReadonlyKeyboardEvent>(event: Readonly<Event>) => void;
  readonly paste: <Event extends ReadonlyClipboardEvent>(event: Readonly<Event>) => void;
}

export interface SelectionPosition {
  readonly blockIndex: number;
  readonly inlineIndex: number;
  readonly listItemIndex?: number;
  readonly offset: number;
}

export type MetaKeyEditorAction = { readonly command: Command } | { readonly type: "requestLink" };

export default {
  attachBrowserAdapterEventListeners,
  beforeInputCommand,
  blockElementName,
  browserAdapterObserverOptions,
  configureEditableHost,
  createRenderingObserver,
  detachBrowserAdapterEventListeners,
  listItemSelectorSuffix,
  metaKeyEditorAction,
  resolveElementFromNode,
  selectionPositionFromNode,
  textLength,
};
