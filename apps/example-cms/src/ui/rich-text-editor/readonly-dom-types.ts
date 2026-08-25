/** Pick-based readonly views of DOM types for the rich text editor boundary. */
export type ReadonlyClipboardEvent = Pick<ClipboardEvent, "clipboardData" | "preventDefault">;

export type ReadonlyCompositionEvent = Pick<CompositionEvent, "data">;

export type ReadonlyDragEvent = Pick<DragEvent, "dataTransfer" | "preventDefault">;

export type ReadonlyEditableHost = Pick<
  HTMLDivElement,
  | "addEventListener"
  | "contentEditable"
  | "contains"
  | "innerHTML"
  | "removeEventListener"
  | "replaceChildren"
  | "setAttribute"
>;

export type ReadonlyHtmlElement = Pick<
  HTMLElement,
  "closest" | "contains" | "dataset" | "textContent"
>;

export type ReadonlyInputEvent = Pick<
  InputEvent,
  "data" | "inputType" | "isComposing" | "preventDefault"
>;

export type ReadonlyKeyboardEvent = Pick<
  KeyboardEvent,
  "ctrlKey" | "key" | "metaKey" | "preventDefault" | "shiftKey"
>;

export interface ReadonlyNativeSelection {
  readonly anchorNode: Node | null;
  readonly anchorOffset: number;
  readonly focusNode: Node | null;
  readonly focusOffset: number;
  readonly rangeCount: number;
}

export type ReadonlyMutationObserverHost = Pick<
  HTMLDivElement,
  "addEventListener" | "removeEventListener"
>;

export type ReadonlySelectionHost = Pick<HTMLElement, "contains" | "isConnected" | "querySelector">;

