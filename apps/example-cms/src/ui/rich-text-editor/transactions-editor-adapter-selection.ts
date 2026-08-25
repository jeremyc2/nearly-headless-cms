import type { State } from "./transactions-types.ts";
import { emptyIndex } from "./transactions-constants.ts";
import { transact } from "./transactions-dispatch.ts";
import transactionsEditorAdapterSupport from "./transactions-editor-adapter-support.ts";

const { listItemSelectorSuffix, selectionPositionFromNode, textLength } =
    transactionsEditorAdapterSupport,
  nativeSelectionPositions = (
    nativeSelection: Selection | null,
    host: HTMLElement,
  ): {
    anchor: NonNullable<ReturnType<typeof selectionPositionFromNode>>;
    focus: NonNullable<ReturnType<typeof selectionPositionFromNode>>;
  } | undefined => {
    if (nativeSelection === null || nativeSelection.rangeCount === emptyIndex) {
      return undefined;
    }
    const anchor = selectionPositionFromNode(
        nativeSelection.anchorNode,
        nativeSelection.anchorOffset,
        host,
      ),
      focus = selectionPositionFromNode(
        nativeSelection.focusNode,
        nativeSelection.focusOffset,
        host,
      );
    if (anchor !== undefined && focus !== undefined) {
      return { anchor, focus };
    }
    return undefined;
  },
  readNativeSelectionPositions = (
    host: HTMLElement,
  ): ReturnType<typeof nativeSelectionPositions> =>
    nativeSelectionPositions(document.getSelection(), host),
  restoreSelectionRange = (state: State, host: HTMLElement): void => {
    if (!host.isConnected) {
      return;
    }
    const { anchor, focus } = state.selection,
      anchorElement = host.querySelector<HTMLElement>(
        `[data-block-index="${anchor.blockIndex}"][data-inline-index="${anchor.inlineIndex}"]${listItemSelectorSuffix(anchor.listItemIndex)}`,
      ),
      anchorNode = anchorElement?.firstChild,
      focusElement = host.querySelector<HTMLElement>(
        `[data-block-index="${focus.blockIndex}"][data-inline-index="${focus.inlineIndex}"]${listItemSelectorSuffix(focus.listItemIndex)}`,
      ),
      focusNode = focusElement?.firstChild,
      nativeSelection = document.getSelection();
    if (
      anchorNode === undefined ||
      anchorNode === null ||
      focusNode === undefined ||
      focusNode === null ||
      nativeSelection === null
    ) {
      return;
    }
    nativeSelection.setBaseAndExtent(
      anchorNode,
      Math.min(anchor.offset, textLength(anchorNode.textContent)),
      focusNode,
      Math.min(focus.offset, textLength(focusNode.textContent)),
    );
  },
  synchronizeSelectionState = (state: State, host: HTMLElement): State => {
    const positions = readNativeSelectionPositions(host);
    if (positions === undefined) {
      return state;
    }
    return transact(state, { anchor: positions.anchor, focus: positions.focus, type: "select" });
  };

export default {
  restoreSelectionRange,
  synchronizeSelectionState,
};
