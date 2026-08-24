import type { RichText } from "nearly-headless-cms";
import { type Command, type State, transact } from "./transactions.ts";

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
    const fragment = document.createDocumentFragment();
    for (const [blockIndex, block] of this.#state.document.children.entries()) {
      fragment.append(this.#renderBlock(block, blockIndex));
    }
    this.#host.replaceChildren(fragment);
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
    const element = document.createElement(
      block.type === "heading"
        ? `h${block.level}`
        : block.type === "quote"
          ? "blockquote"
          : block.type === "code-block"
            ? "pre"
            : block.type === "ordered-list"
              ? "ol"
              : block.type === "unordered-list"
                ? "ul"
                : block.type === "asset-reference"
                  ? "figure"
                  : "p",
    );
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
          text.textContent = child.text.length === 0 ? "\u200b" : child.text;
          if (child.marks?.includes("bold")) {
            text.style.fontWeight = "700";
          }
          if (child.marks?.includes("italic")) {
            text.style.fontStyle = "italic";
          }
          if (child.marks?.includes("code")) {
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
        )
          element.append(this.#renderBlock(child, blockIndex, listItemIndex));
        else if (child.type === "link" || child.type === "entry-reference") {
          const inline = document.createElement(child.type === "link" ? "a" : "span");
          inline.dataset["nodeType"] = child.type;
          if (child.type === "link") inline.setAttribute("href", child.url);
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
    | { readonly blockIndex: number; readonly inlineIndex: number; readonly offset: number }
    | undefined {
    const element = node instanceof Element ? node : node?.parentElement,
      text = element?.closest<HTMLElement>("[data-block-index][data-inline-index]");
    if (text === undefined || text === null || !this.#host.contains(text)) {
      return undefined;
    }
    const blockIndex = Number(text.dataset["blockIndex"]),
      inlineIndex = Number(text.dataset["inlineIndex"]),
      boundedOffset = Math.min(
        offset,
        text.textContent === "\u200b" ? 0 : (text.textContent?.length ?? 0),
      );
    return Number.isSafeInteger(blockIndex) && Number.isSafeInteger(inlineIndex)
      ? {
          blockIndex,
          inlineIndex,
          ...(text.dataset["listItemIndex"] === undefined
            ? {}
            : { listItemIndex: Number(text.dataset["listItemIndex"]) }),
          offset: boundedOffset,
        }
      : undefined;
  }

  #synchronizeSelection(): void {
    const nativeSelection = document.getSelection();
    if (nativeSelection === null || nativeSelection.rangeCount === 0) {
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
        `[data-block-index="${anchor.blockIndex}"][data-inline-index="${anchor.inlineIndex}"]${anchor.listItemIndex === undefined ? "" : `[data-list-item-index="${anchor.listItemIndex}"]`}`,
      ),
      focusElement = this.#host.querySelector<HTMLElement>(
        `[data-block-index="${focus.blockIndex}"][data-inline-index="${focus.inlineIndex}"]${focus.listItemIndex === undefined ? "" : `[data-list-item-index="${focus.listItemIndex}"]`}`,
      ),
      anchorNode = anchorElement?.firstChild,
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
        anchorNode.textContent === "\u200b" ? 0 : (anchorNode.textContent?.length ?? 0),
      ),
      focusNode,
      Math.min(
        focus.offset,
        focusNode.textContent === "\u200b" ? 0 : (focusNode.textContent?.length ?? 0),
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
      this.dispatch({ type: event.shiftKey ? "redo" : "undo" });
    }
  };

  readonly #handleCompositionStart = (): void => {
    this.#synchronizeSelection();
    this.dispatch({ active: true, type: "composition" });
  };
  readonly #handleCompositionEnd = (event: CompositionEvent): void => {
    this.dispatch({ active: false, type: "composition" });
    if (event.data.length > 0) {
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
