import type { RichText } from "nearly-headless-cms";
import { emptyIndex } from "./transactions-constants.ts";
import transactionsSupport from "./transactions-support.ts";
import type { Command } from "./transactions-types.ts";

const { conditionalValue } = transactionsSupport,
  listItemSelectorSuffix = (listItemIndex: number | undefined): string => {
    if (listItemIndex === undefined) {
      return "";
    }
    return `[data-list-item-index="${listItemIndex}"]`;
  },
  textLength = (text: string | null | undefined): number => {
    if (text === "\u200B") {
      return emptyIndex;
    }
    return text?.length ?? emptyIndex;
  },
  blockElementName = (block: RichText.BlockNode): string => {
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
  resolveElementFromNode = (node: Node | null): Element | null | undefined => {
    if (node instanceof Element) {
      return node;
    }
    return node?.parentElement;
  },
  selectionPositionFromNode = (
    node: Node | null,
    offset: number,
    host: HTMLElement,
  ): SelectionPosition | undefined => {
    const element = resolveElementFromNode(node),
      text = element?.closest<HTMLElement>("[data-block-index][data-inline-index]");
    if (text === undefined || text === null || !host.contains(text)) {
      return undefined;
    }
    const blockIndex = Number(text.dataset["blockIndex"]),
      inlineIndex = Number(text.dataset["inlineIndex"]);
    if (!Number.isSafeInteger(blockIndex) || !Number.isSafeInteger(inlineIndex)) {
      return undefined;
    }
    const boundedOffset = Math.min(offset, textLength(text.textContent)),
      position = { blockIndex, inlineIndex, offset: boundedOffset };
    if (text.dataset["listItemIndex"] === undefined) {
      return position;
    }
    return { ...position, listItemIndex: Number(text.dataset["listItemIndex"]) };
  },
  browserAdapterObserverOptions = {
    characterData: true,
    childList: true,
    subtree: true,
  } as const,
  configureEditableHost = (host: HTMLDivElement): void => {
    host.contentEditable = "true";
    host.setAttribute("role", "textbox");
    host.setAttribute("aria-multiline", "true");
  },
  attachBrowserAdapterEventListeners = (
    host: HTMLDivElement,
    handlers: BrowserAdapterEventHandlers,
  ): void => {
    host.addEventListener("beforeinput", handlers.beforeInput);
    host.addEventListener("keydown", handlers.keyDown);
    host.addEventListener("compositionstart", handlers.compositionStart);
    host.addEventListener("compositionend", handlers.compositionEnd);
    host.addEventListener("paste", handlers.paste);
    host.addEventListener("drop", handlers.drop);
  },
  detachBrowserAdapterEventListeners = (
    host: HTMLDivElement,
    handlers: BrowserAdapterEventHandlers,
  ): void => {
    host.removeEventListener("beforeinput", handlers.beforeInput);
    host.removeEventListener("keydown", handlers.keyDown);
    host.removeEventListener("compositionstart", handlers.compositionStart);
    host.removeEventListener("compositionend", handlers.compositionEnd);
    host.removeEventListener("paste", handlers.paste);
    host.removeEventListener("drop", handlers.drop);
  },
  createRenderingObserver = (
    host: HTMLDivElement,
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
  beforeInputCommand = (event: InputEvent): Command | undefined => {
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
  metaKeyEditorAction = (event: KeyboardEvent): MetaKeyEditorAction | undefined => {
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
  };

export interface BrowserAdapterEventHandlers {
  readonly beforeInput: (event: InputEvent) => void;
  readonly compositionEnd: (event: CompositionEvent) => void;
  readonly compositionStart: () => void;
  readonly drop: (event: DragEvent) => void;
  readonly keyDown: (event: KeyboardEvent) => void;
  readonly paste: (event: ClipboardEvent) => void;
}

export interface SelectionPosition {
  readonly blockIndex: number;
  readonly inlineIndex: number;
  readonly listItemIndex?: number;
  readonly offset: number;
}

export type MetaKeyEditorAction =
  | { readonly command: Command }
  | { readonly type: "requestLink" };

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
