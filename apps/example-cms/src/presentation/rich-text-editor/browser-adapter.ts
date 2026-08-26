import { type Command, type State, transact } from "./transactions.ts";
import type {
  ReadonlyClipboardEvent,
  ReadonlyCompositionEvent,
  ReadonlyDragEvent,
  ReadonlyEditableHost,
  ReadonlyInputEvent,
  ReadonlyKeyboardEvent,
} from "./readonly-dom-types.ts";
import type { RichText } from "nearly-headless-cms";
import { emptyIndex } from "./transactions-constants.ts";
import transactionsEditorAdapterInternals from "./transactions-editor-adapter-internals.ts";
import browserAdapterHandlers from "./browser-adapter-handlers.ts";

const { applyBrowserBeforeInput, applyBrowserKeyDown } = browserAdapterHandlers,
  {
    attachBrowserAdapterEventListeners,
    browserAdapterObserverOptions,
    configureEditableHost,
    createRenderingObserver,
    detachBrowserAdapterEventListeners,
    renderBlockElement,
    restoreSelectionRange,
    synchronizeSelectionState,
  } = transactionsEditorAdapterInternals;

export interface BrowserAdapterOptions {
  readonly host: ReadonlyEditableHost;
  readonly initialState: State;
  readonly onChange: (document: RichText.Document) => void;
  readonly onRequestLink?: () => void;
  readonly onStateChange?: (state: State) => void;
}

export class BrowserAdapter {
  readonly #host: ReadonlyEditableHost;
  readonly #onChange: (document: RichText.Document) => void;
  readonly #onRequestLink: (() => void) | undefined;
  readonly #onStateChange: ((state: State) => void) | undefined;
  #state: State;
  readonly #observer: MutationObserver;
  #deleteKeyHandled = false;
  #rendering = false;

  constructor(options: Readonly<BrowserAdapterOptions>) {
    this.#host = options.host;
    this.#state = options.initialState;
    this.#onChange = options.onChange;
    this.#onRequestLink = options.onRequestLink;
    this.#onStateChange = options.onStateChange;
    this.#observer = this.#createObserver();
    this.#attachHost();
  }

  #attachHost(): void {
    configureEditableHost(this.#host);
    attachBrowserAdapterEventListeners(this.#host, this.#eventHandlers());
    document.addEventListener("selectionchange", this.#handleSelectionChange);
    this.#notifyStateChange();
    this.render();
  }

  #createObserver(): MutationObserver {
    return createRenderingObserver(
      this.#host,
      () => !this.#rendering && !this.#state.composing,
      () => {
        this.render();
      },
    );
  }

  get state(): State {
    return this.#state;
  }

  captureEditorSelection(): void {
    const priorState = this.#state;
    this.#state = synchronizeSelectionState(
      this.#state,
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- [EH-213] synchronizeSelectionState queries the runtime editable host for the current DOM selection.
      this.#host as unknown as HTMLElement,
    );
    if (priorState !== this.#state) {
      this.#notifyStateChange();
    }
  }

  dispatch(command: Command): void {
    this.#applyCommand(command);
  }

  dispatchToolbarCommand(command: Command): void {
    this.#synchronizeSelection();
    this.#applyCommand(command);
  }

  #applyCommand(command: Command): void {
    const priorDocument = this.#state.document;
    this.#state = transact(this.#state, command);
    if (priorDocument !== this.#state.document) {
      this.render();
      this.#onChange(this.#state.document);
    }
    this.#notifyStateChange();
  }

  #notifyStateChange(): void {
    this.#onStateChange?.(this.#state);
  }

  render(): void {
    this.#rendering = true;
    this.#observer.disconnect();
    const fragment = document.createDocumentFragment();
    for (const [blockIndex, block] of this.#state.document.children.entries()) {
      fragment.append(renderBlockElement(block, blockIndex));
    }
    this.#host.replaceChildren(fragment);
    restoreSelectionRange(
      this.#state,
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- [EH-211] restoreSelectionRange reads selection anchors from the runtime editable host.
      this.#host as unknown as HTMLElement,
    );
    this.#rendering = false;
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- [EH-207] MutationObserver.observe requires Node; the editable host is a runtime HTMLElement.
    this.#observer.observe(this.#host as unknown as Node, browserAdapterObserverOptions);
  }

  destroy(): void {
    this.#observer.disconnect();
    detachBrowserAdapterEventListeners(this.#host, this.#eventHandlers());
    document.removeEventListener("selectionchange", this.#handleSelectionChange);
  }

  #eventHandlers() {
    return {
      beforeInput: this.#handleBeforeInput,
      compositionEnd: this.#handleCompositionEnd,
      compositionStart: this.#handleCompositionStart,
      drop: this.#handleDrop,
      keyDown: this.#handleKeyDown,
      paste: this.#handlePaste,
    };
  }

  #synchronizeSelection(): void {
    this.#state = synchronizeSelectionState(
      this.#state,
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- [EH-213] synchronizeSelectionState queries the runtime editable host for the current DOM selection.
      this.#host as unknown as HTMLElement,
    );
  }

  readonly #handleBeforeInput = <Event extends ReadonlyInputEvent>(
    event: Readonly<Event>,
  ): void => {
    applyBrowserBeforeInput({
      clearDeleteHandled: () => {
        this.#deleteKeyHandled = false;
      },
      composing: this.#state.composing,
      deleteKeyHandled: this.#deleteKeyHandled,
      dispatch: (command) => {
        this.dispatch(command);
      },
      event,
      synchronizeSelection: () => {
        this.#synchronizeSelection();
      },
    });
  };

  readonly #handleKeyDown = <Event extends ReadonlyKeyboardEvent>(event: Readonly<Event>): void => {
    applyBrowserKeyDown({
      dispatch: (command) => {
        this.dispatch(command);
      },
      event,
      markDeleteHandled: () => {
        this.#deleteKeyHandled = true;
      },
      onRequestLink: this.#onRequestLink,
      synchronizeSelection: () => {
        this.#synchronizeSelection();
      },
    });
  };

  readonly #handleCompositionStart = (): void => {
    this.#synchronizeSelection();
    this.dispatch({ active: true, type: "composition" });
  };
  readonly #handleCompositionEnd = <Event extends ReadonlyCompositionEvent>(
    event: Readonly<Event>,
  ): void => {
    this.dispatch({ active: false, type: "composition" });
    if (event.data.length > emptyIndex) {
      this.dispatch({ text: event.data, type: "insertText" });
    }
  };
  readonly #handlePaste = <Event extends ReadonlyClipboardEvent>(event: Readonly<Event>): void => {
    event.preventDefault();
    this.#synchronizeSelection();
    this.dispatch({ text: event.clipboardData?.getData("text/plain") ?? "", type: "insertText" });
  };
  readonly #handleDrop = <Event extends ReadonlyDragEvent>(event: Readonly<Event>): void => {
    event.preventDefault();
    this.#synchronizeSelection();
    this.dispatch({ text: event.dataTransfer?.getData("text/plain") ?? "", type: "insertText" });
  };
  readonly #handleSelectionChange = (): void => {
    if (!this.#rendering) {
      const priorState = this.#state;
      this.#state = synchronizeSelectionState(
        this.#state,
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- [EH-213] synchronizeSelectionState queries the runtime editable host for the current DOM selection.
        this.#host as unknown as HTMLElement,
      );
      if (priorState !== this.#state) {
        this.#notifyStateChange();
      }
    }
  };
}
