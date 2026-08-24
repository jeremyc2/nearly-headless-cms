import type { RichText } from "nearly-headless-cms";
import { type Command, type State, transact } from "./transactions.ts";

const EMPTY_TEXT_OFFSET = 0;

function textLength(text: string | null | undefined): number {
  if (text === "\u200B") {
    return EMPTY_TEXT_OFFSET;
  }
  return text?.length ?? EMPTY_TEXT_OFFSET;
}

function listItemSelectorSuffix(listItemIndex: number | undefined): string {
  if (listItemIndex === undefined) {
    return "";
  }
  return `[data-list-item-index="${listItemIndex}"]`;
}

export interface BrowserAdapterOptions {
  readonly host: HTMLDivElement;
  readonly initialState: State;
  readonly onChange: (document: RichText.Document) => void;
  readonly onRequestLink?: () => void;
}

export class BrowserAdapter {
  readonly #host: HTMLDivElement;
  readonly #onChange: (document: RichText.Document) => void;
  readonly #onRequestLink: (() => void) | undefined;
  #state: State;
  readonly #observer: MutationObserver;
  #rendering = false;

  constructor(options: BrowserAdapterOptions) {
    this.#host = options.host;
    this.#state = options.initialState;
    this.#onChange = options.onChange;
    this.#onRequestLink = options.onRequestLink;
    this.#host.contentEditable = "true";
    this.#host.setAttribute("role", "textbox");
    this.#host.setAttribute("aria-multiline", "true");
    this.#observer = new MutationObserver(() => {
      if (!this.#rendering && !this.#state.composing) {
        this.render();
      }
    });
    this.#observer.observe(this.#host, { characterData: true, childList: true, subtree: true });
    this.#host.addEventListener("beforeinput", this.#handleBeforeInput);
    this.#host.addEventListener("keydown", this.#handleKeyDown);
    this.#host.addEventListener("compositionstart", this.#handleCompositionStart);
    this.#host.addEventListener("compositionend", this.#handleCompositionEnd);
    this.#host.addEventListener("paste", this.#handlePaste);
    this.#host.addEventListener("drop", this.#handleDrop);
    document.addEventListener("selectionchange", this.#handleSelectionChange);
    this.render();
  }

  get state(): State {
    return this.#state;
  }

  dispatch(command: Command): void {
    const priorDocument = this.#state.document;
    this.#state = transact(this.#state, command);
    if (priorDocument !== this.#state.document) {
      this.render();
      this.#onChange(this.#state.document);
    }
  }

  render(): void {
    this.#rendering = true;
    this.#observer.disconnect();
    const fragment = document.createDocumentFragment();
    for (const [blockIndex, block] of this.#state.document.children.entries()) {
      fragment.append(this.#renderBlock(block, blockIndex));
    }
    this.#host.replaceChildren(fragment);
    this.#observer.observe(this.#host, { characterData: true, childList: true, subtree: true });
    this.#rendering = false;
    this.#restoreSelection();
  }

  destroy(): void {
    this.#observer.disconnect();
    this.#host.removeEventListener("beforeinput", this.#handleBeforeInput);
    this.#host.removeEventListener("keydown", this.#handleKeyDown);
    this.#host.removeEventListener("compositionstart", this.#handleCompositionStart);
    this.#host.removeEventListener("compositionend", this.#handleCompositionEnd);
    this.#host.removeEventListener("paste", this.#handlePaste);
    this.#host.removeEventListener("drop", this.#handleDrop);
    document.removeEventListener("selectionchange", this.#handleSelectionChange);
  }

  #renderBlock(
    block: RichText.BlockNode,
    blockIndex?: number,
    listItemIndex?: number,
  ): HTMLElement {
    let elementName = "p";
    if (block.type === "heading") {
      elementName = `h${block.level}`;
    } else if (block.type === "quote") {
      elementName = "blockquote";
    } else if (block.type === "code-block") {
      elementName = "pre";
    } else if (block.type === "ordered-list") {
      elementName = "ol";
    } else if (block.type === "unordered-list") {
      elementName = "ul";
    } else if (block.type === "asset-reference") {
      elementName = "figure";
    }
    const element = document.createElement(elementName);
    element.dataset["nodeType"] = block.type;
    if (block.type === "asset-reference") {
      element.contentEditable = "false";
      const label = document.createElement("strong");
      label.textContent = block.alternativeText || "Image without alternative text";
      element.append(label);
      if (block.caption !== undefined) {
        const caption = document.createElement("figcaption");
        caption.textContent = block.caption;
        element.append(caption);
      }
      return element;
    }
    if ("children" in block) {
      for (const [inlineIndex, child] of block.children.entries()) {
        if (child.type === "text") {
          const text = document.createElement("span");
          if (blockIndex !== undefined) {
            text.dataset["blockIndex"] = String(blockIndex);
            text.dataset["inlineIndex"] = String(inlineIndex);
            if (listItemIndex !== undefined) {
              text.dataset["listItemIndex"] = String(listItemIndex);
            }
          }
          if (child.text.length === EMPTY_TEXT_OFFSET) {
            text.textContent = "\u200B";
          } else {
            text.textContent = child.text;
          }
          if (child.marks?.includes("bold") === true) {
            text.style.fontWeight = "700";
          }
          if (child.marks?.includes("italic") === true) {
            text.style.fontStyle = "italic";
          }
          if (child.marks?.includes("code") === true) {
            text.className = "rich-inline-code";
          }
          element.append(text);
        } else if (
          child.type === "paragraph" ||
          child.type === "heading" ||
          child.type === "quote" ||
          child.type === "code-block" ||
          child.type === "ordered-list" ||
          child.type === "unordered-list" ||
          child.type === "asset-reference"
        ) {
          element.append(this.#renderBlock(child, blockIndex, listItemIndex));
        } else if (child.type === "link" || child.type === "entry-reference") {
          let elementName = "span";
          if (child.type === "link") {
            elementName = "a";
          }
          const inline = document.createElement(elementName);
          inline.dataset["nodeType"] = child.type;
          if (child.type === "link") {
            inline.setAttribute("href", child.url);
          }
          for (const grandchild of child.children) {
            inline.append(document.createTextNode(grandchild.text));
          }
          element.append(inline);
        } else if (child.type === "list-item") {
          const listItem = document.createElement("li");
          for (const grandchild of child.children) {
            listItem.append(this.#renderBlock(grandchild, blockIndex, inlineIndex));
          }
          element.append(listItem);
        } else {
          const unsupported = document.createElement("aside");
          unsupported.textContent = `Unsupported editor extension: ${child.type}`;
          element.append(unsupported);
        }
      }
    }
    return element;
  }

  #selectionPosition(
    node: Node | null,
    offset: number,
  ):
    | {
        readonly blockIndex: number;
        readonly inlineIndex: number;
        readonly listItemIndex?: number;
        readonly offset: number;
      }
    | undefined {
    let element: Element | null | undefined;
    if (node instanceof Element) {
      element = node;
    } else {
      element = node?.parentElement;
    }
    const text = element?.closest<HTMLElement>("[data-block-index][data-inline-index]");
    if (text === undefined || text === null || !this.#host.contains(text)) {
      return undefined;
    }
    const blockIndex = Number(text.dataset["blockIndex"]),
      boundedOffset = Math.min(
        offset,
        textLength(text.textContent),
      ),
      inlineIndex = Number(text.dataset["inlineIndex"]);
    if (!Number.isSafeInteger(blockIndex) || !Number.isSafeInteger(inlineIndex)) {
      return undefined;
    }
    const position = { blockIndex, inlineIndex, offset: boundedOffset };
    if (text.dataset["listItemIndex"] !== undefined) {
      return { ...position, listItemIndex: Number(text.dataset["listItemIndex"]) };
    }
    return position;
  }

  #synchronizeSelection(): void {
    const nativeSelection = document.getSelection();
    if (nativeSelection === null || nativeSelection.rangeCount === EMPTY_TEXT_OFFSET) {
      return;
    }
    const anchor = this.#selectionPosition(
        nativeSelection.anchorNode,
        nativeSelection.anchorOffset,
      ),
      focus = this.#selectionPosition(nativeSelection.focusNode, nativeSelection.focusOffset);
    if (anchor !== undefined && focus !== undefined) {
      this.#state = transact(this.#state, { anchor, focus, type: "select" });
    }
  }

  #restoreSelection(): void {
    if (!this.#host.isConnected) {
      return;
    }
    const { anchor, focus } = this.#state.selection,
      anchorElement = this.#host.querySelector<HTMLElement>(
        `[data-block-index="${anchor.blockIndex}"][data-inline-index="${anchor.inlineIndex}"]${listItemSelectorSuffix(anchor.listItemIndex)}`,
      ),
      anchorNode = anchorElement?.firstChild,
      focusElement = this.#host.querySelector<HTMLElement>(
        `[data-block-index="${focus.blockIndex}"][data-inline-index="${focus.inlineIndex}"]${listItemSelectorSuffix(focus.listItemIndex)}`,
      ),
      focusNode = focusElement?.firstChild;
    if (
      anchorNode === undefined ||
      anchorNode === null ||
      focusNode === undefined ||
      focusNode === null
    ) {
      return;
    }
    const nativeSelection = document.getSelection();
    if (nativeSelection === null) {
      return;
    }
    nativeSelection.setBaseAndExtent(
      anchorNode,
      Math.min(
        anchor.offset,
        textLength(anchorNode.textContent),
      ),
      focusNode,
      Math.min(
        focus.offset,
        textLength(focusNode.textContent),
      ),
    );
  }

  readonly #handleBeforeInput = (event: InputEvent): void => {
    if (this.#state.composing) {
      return;
    }
    this.#synchronizeSelection();
    if (event.inputType === "insertText" && event.data !== null) {
      event.preventDefault();
      this.dispatch({ text: event.data, type: "insertText" });
    }
    if (event.inputType === "deleteContentBackward") {
      event.preventDefault();
      this.dispatch({ type: "deleteBackward" });
    }
    if (event.inputType === "insertParagraph") {
      event.preventDefault();
      this.dispatch({ type: "splitBlock" });
    }
  };

  readonly #handleKeyDown = (event: KeyboardEvent): void => {
    this.#synchronizeSelection();
    if (!event.metaKey) {
      return;
    }
    if (event.key.toLowerCase() === "b") {
      event.preventDefault();
      this.dispatch({ mark: "bold", type: "toggleMark" });
    }
    if (event.key.toLowerCase() === "i") {
      event.preventDefault();
      this.dispatch({ mark: "italic", type: "toggleMark" });
    }
    if (event.key.toLowerCase() === "k") {
      event.preventDefault();
      this.#onRequestLink?.();
    }
    if (event.key.toLowerCase() === "z") {
      event.preventDefault();
      let actionType: "redo" | "undo" = "undo";
      if (event.shiftKey) {
        actionType = "redo";
      }
      this.dispatch({ type: actionType });
    }
  };

  readonly #handleCompositionStart = (): void => {
    this.#synchronizeSelection();
    this.dispatch({ active: true, type: "composition" });
  };
  readonly #handleCompositionEnd = (event: CompositionEvent): void => {
    this.dispatch({ active: false, type: "composition" });
    if (event.data.length > EMPTY_TEXT_OFFSET) {
      this.dispatch({ text: event.data, type: "insertText" });
    }
  };
  readonly #handlePaste = (event: ClipboardEvent): void => {
    event.preventDefault();
    this.#synchronizeSelection();
    this.dispatch({ text: event.clipboardData?.getData("text/plain") ?? "", type: "insertText" });
  };
  readonly #handleDrop = (event: DragEvent): void => {
    event.preventDefault();
    this.#synchronizeSelection();
    this.dispatch({ text: event.dataTransfer?.getData("text/plain") ?? "", type: "insertText" });
  };
  readonly #handleSelectionChange = (): void => {
    if (!this.#rendering) {
      this.#synchronizeSelection();
    }
  };
}
