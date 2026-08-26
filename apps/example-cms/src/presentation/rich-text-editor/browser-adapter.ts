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

const {
    attachBrowserAdapterEventListeners,
    beforeInputCommand,
    browserAdapterObserverOptions,
    configureEditableHost,
    createRenderingObserver,
    detachBrowserAdapterEventListeners,
    metaKeyEditorAction,
    renderBlockElement,
    restoreSelectionRange,
    synchronizeSelectionState,
  } = transactionsEditorAdapterInternals,
  applyMetaKeyEditorAction = ({
    action,
    dispatch,
    onRequestLink,
  }: {
    readonly action: NonNullable<ReturnType<typeof metaKeyEditorAction>>;
    readonly dispatch: (command: Command) => void;
    readonly onRequestLink: (() => void) | undefined;
  }): void => {
    if ("command" in action) {
      dispatch(action.command);
      return;
    }
    onRequestLink?.();
  };

export interface BrowserAdapterOptions {
  readonly host: ReadonlyEditableHost;
  readonly initialState: State;
  readonly onChange: (document: RichText.Document) => void;
  readonly onRequestLink?: () => void;
}

export class BrowserAdapter {
  readonly #host: ReadonlyEditableHost;
  readonly #onChange: (document: RichText.Document) => void;
  readonly #onRequestLink: (() => void) | undefined;
  #state: State;
  readonly #observer: MutationObserver;
  #rendering = false;

  constructor(options: Readonly<BrowserAdapterOptions>) {
    this.#host = options.host;
    this.#state = options.initialState;
    this.#onChange = options.onChange;
    this.#onRequestLink = options.onRequestLink;
    configureEditableHost(this.#host);
    this.#observer = createRenderingObserver(
      this.#host,
      () => !this.#rendering && !this.#state.composing,
      () => {
        this.render();
      },
    );
    attachBrowserAdapterEventListeners(this.#host, this.#eventHandlers());
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
      fragment.append(renderBlockElement(block, blockIndex));
    }
    this.#host.replaceChildren(fragment);
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- [EH-207] MutationObserver.observe requires Node; the editable host is a runtime HTMLElement.
    this.#observer.observe(this.#host as unknown as Node, browserAdapterObserverOptions);
    this.#rendering = false;
    restoreSelectionRange(
      this.#state,
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- [EH-211] restoreSelectionRange reads selection anchors from the runtime editable host.
      this.#host as unknown as HTMLElement,
    );
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
    if (this.#state.composing) {
      return;
    }
    this.#synchronizeSelection();
    const command = beforeInputCommand(event);
    if (command !== undefined) {
      event.preventDefault();
      this.dispatch(command);
    }
  };

  readonly #handleKeyDown = <Event extends ReadonlyKeyboardEvent>(event: Readonly<Event>): void => {
    this.#synchronizeSelection();
    if (!event.metaKey) {
      return;
    }
    const action = metaKeyEditorAction(event);
    if (action === undefined) {
      return;
    }
    event.preventDefault();
    applyMetaKeyEditorAction({
      action,
      dispatch: (command) => {
        this.dispatch(command);
      },
      onRequestLink: this.#onRequestLink,
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
      this.#synchronizeSelection();
    }
  };
}
