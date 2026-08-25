import type { ReadonlyEditableHost, ReadonlyNativeSelection } from "./readonly-dom-types.ts";
import type { State } from "./transactions-types.ts";
import { emptyIndex } from "./transactions-constants.ts";
import { transact } from "./transactions-dispatch.ts";
import transactionsEditorAdapterSupport from "./transactions-editor-adapter-support.ts";

const { listItemSelectorSuffix, selectionPositionFromNode, textLength } =
    transactionsEditorAdapterSupport,
  nativeSelectionPositions = <
    Input extends {
      readonly host: ReadonlyEditableHost;
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
  readNativeSelectionPositions = (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-170] editable hosts are queried for live native selection state.
    host: HTMLElement,
  ) =>
    nativeSelectionPositions({
      host,
      nativeSelection: document.getSelection(),
    }),
  restoreSelectionRange = (
    state: Readonly<State>,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-169] editable hosts are mutated while restoring native selection ranges.
    host: HTMLElement,
  ): void => {
    if (!host.isConnected) {
      return;
    }
    const { anchor, focus } = state.selection,
      anchorElement = host.querySelector(
        `[data-block-index="${anchor.blockIndex}"][data-inline-index="${anchor.inlineIndex}"]${listItemSelectorSuffix(anchor.listItemIndex)}`,
      ),
      anchorNode = anchorElement?.firstChild,
      focusElement = host.querySelector(
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
  synchronizeSelectionState = (
    state: Readonly<State>,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-171] editable hosts are queried while synchronizing editor selection state.
    host: HTMLElement,
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
