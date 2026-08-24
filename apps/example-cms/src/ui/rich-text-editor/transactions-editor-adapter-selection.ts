import transactionsEditorAdapterSupport from "./transactions-editor-adapter-support.ts";
import { emptyIndex } from "./transactions-constants.ts";
import { transact } from "./transactions-dispatch.ts";
import type { State } from "./transactions-types.ts";

const { listItemSelectorSuffix, selectionPositionFromNode, textLength } =
    transactionsEditorAdapterSupport,
  synchronizeSelectionState = (state: State, host: HTMLElement): State => {
    const nativeSelection = document.getSelection();
    if (nativeSelection === null || nativeSelection.rangeCount === emptyIndex) {
      return state;
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
      return transact(state, { anchor, focus, type: "select" });
    }
    return state;
  },
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
  };

export default {
  restoreSelectionRange,
  synchronizeSelectionState,
};
