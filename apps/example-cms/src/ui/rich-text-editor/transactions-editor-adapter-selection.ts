import type { ReadonlyNativeSelection, ReadonlySelectionHost } from "./readonly-dom-types.ts";
import type { State } from "./transactions-types.ts";
import { emptyIndex } from "./transactions-constants.ts";
import { transact } from "./transactions-dispatch.ts";
import transactionsEditorAdapterSupport from "./transactions-editor-adapter-support.ts";

const { listItemSelectorSuffix, selectionPositionFromNode, textLength } =
    transactionsEditorAdapterSupport,
  nativeSelectionPositions = <
    Input extends {
      readonly host: ReadonlySelectionHost;
      readonly nativeSelection: ReadonlyNativeSelection | null;
    },
  >(
    input: Readonly<Input>,
  ):
    | {
        anchor: NonNullable<ReturnType<typeof selectionPositionFromNode>>;
        focus: NonNullable<ReturnType<typeof selectionPositionFromNode>>;
      }
    | undefined => {
    if (input.nativeSelection === null || input.nativeSelection.rangeCount === emptyIndex) {
      return undefined;
    }
    const anchor = selectionPositionFromNode(
        input.nativeSelection.anchorNode,
        input.nativeSelection.anchorOffset,
        input.host,
      ),
      focus = selectionPositionFromNode(
        input.nativeSelection.focusNode,
        input.nativeSelection.focusOffset,
        input.host,
      );
    if (anchor !== undefined && focus !== undefined) {
      return { anchor, focus };
    }
    return undefined;
  },
  readNativeSelectionPositions = <Host extends ReadonlySelectionHost>(
    host: Readonly<Host>,
  ) =>
    nativeSelectionPositions({
      host,
      nativeSelection: document.getSelection(),
    }),
  restoreSelectionRange = <Host extends ReadonlySelectionHost>(
    state: Readonly<State>,
    host: Readonly<Host>,
  ): void => {
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
  synchronizeSelectionState = <Host extends ReadonlySelectionHost>(
    state: Readonly<State>,
    host: Readonly<Host>,
  ): State => {
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
