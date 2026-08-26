import { emptyDocument, emptyIndex, firstIndex } from "./transactions-constants.ts";
import type { Position, State } from "./transactions-types.ts";
import type { RichText } from "nearly-headless-cms";
import transactionsDeleteCrossBlock from "./transactions-delete-cross-block.ts";
import transactionsMutations from "./transactions-mutations.ts";
import transactionsSelection, { type SelectedInlineRange } from "./transactions-selection.ts";
import transactionsSelectionOffset from "./transactions-selection-offset.ts";
import transactionsState from "./transactions-state.ts";

const { deleteInlineRange } = transactionsMutations,
  { buildMergedBlock, workDeleteCrossBlockRange } = transactionsDeleteCrossBlock,
  { readSelectedCrossBlockRange, selectedInlineRange } = transactionsSelection,
  { documentEndPosition, inlineBlockTextLength, positionFromAbsoluteOffset } =
    transactionsSelectionOffset,
  { commit } = transactionsState,
  coversEntireDocument = (state: State, start: Position, end: Position): boolean => {
    const firstPosition = {
        blockIndex: emptyIndex,
        inlineIndex: emptyIndex,
        offset: emptyIndex,
      },
      lastPosition = documentEndPosition(state.document);
    return positionsEqual(start, firstPosition) && positionsEqual(end, lastPosition);
  },
  deleteCrossBlockRange = (
    state: State,
    range: NonNullable<ReturnType<typeof readSelectedCrossBlockRange>>,
  ): State => {
    if (coversEntireDocument(state, range.start, range.end)) {
      return commit(state, emptyDocument(), {
        anchor: { blockIndex: emptyIndex, inlineIndex: emptyIndex, offset: emptyIndex },
        focus: { blockIndex: emptyIndex, inlineIndex: emptyIndex, offset: emptyIndex },
      });
    }
    return workDeleteCrossBlockRange(state, range);
  },
  deleteInlineSelection = (state: State, inlineRange: SelectedInlineRange): State =>
    deleteInlineRange(state, inlineRange),
  deleteSelection = (state: State, direction: "backward" | "forward"): State => {
    const inlineRange = selectedInlineRange(state);
    if (inlineRange !== undefined && inlineRange.start !== inlineRange.end) {
      return deleteInlineSelection(state, inlineRange);
    }
    const crossBlockRange = readSelectedCrossBlockRange(state);
    if (crossBlockRange !== undefined) {
      return deleteCrossBlockRange(state, crossBlockRange);
    }
    if (inlineRange === undefined) {
      return state;
    }
    return direction === "backward"
      ? workDeleteBackwardCollapsed(state, inlineRange)
      : workDeleteForwardCollapsed(state, inlineRange);
  },
  isJoinableRootBlock = (
    block: RichText.BlockNode | undefined,
  ): block is RichText.ParagraphNode | RichText.HeadingNode =>
    block?.type === "paragraph" || block?.type === "heading",
  joinBlockBackward = (state: State, inlineRange: SelectedInlineRange): State => {
    const { blockIndex } = state.selection.anchor;
    if (blockIndex === emptyIndex) {
      return state;
    }
    const previousRoot = state.document.children[blockIndex - firstIndex],
      currentRoot = state.document.children[blockIndex];
    if (!isJoinableRootBlock(previousRoot) || !isJoinableRootBlock(currentRoot)) {
      return state;
    }
    return commitJoinedBlock({
      blockIndex: blockIndex - firstIndex,
      cursorAbsolute: inlineBlockTextLength(previousRoot),
      mergedBlock: buildMergedBlock({
        endRootBlock: currentRoot,
        mergedChildren: [...previousRoot.children, ...inlineRange.block.children],
        startRootBlock: previousRoot,
      }),
      state,
      trailingStartIndex: blockIndex + firstIndex,
    });
  },
  joinBlockForward = (state: State, inlineRange: SelectedInlineRange): State => {
    const { blockIndex } = state.selection.anchor,
      nextRoot = state.document.children[blockIndex + firstIndex],
      currentRoot = state.document.children[blockIndex];
    if (nextRoot === undefined || !isJoinableRootBlock(currentRoot) || !isJoinableRootBlock(nextRoot)) {
      return state;
    }
    return commitJoinedBlock({
      blockIndex,
      cursorAbsolute: inlineRange.start,
      mergedBlock: buildMergedBlock({
        endRootBlock: nextRoot,
        mergedChildren: [...inlineRange.block.children, ...nextRoot.children],
        startRootBlock: currentRoot,
      }),
      state,
      trailingStartIndex: blockIndex + firstIndex + firstIndex,
    });
  },
  commitJoinedBlock = (input: {
    readonly blockIndex: number;
    readonly cursorAbsolute: number;
    readonly mergedBlock: RichText.ParagraphNode | RichText.HeadingNode;
    readonly state: State;
    readonly trailingStartIndex: number;
  }): State => {
    const { blockIndex, cursorAbsolute, mergedBlock, state, trailingStartIndex } = input,
      nextChildren = [
        ...state.document.children.slice(emptyIndex, blockIndex),
        mergedBlock,
        ...state.document.children.slice(trailingStartIndex),
      ],
      selection = {
        anchor: positionFromAbsoluteOffset({
          absoluteOffset: cursorAbsolute,
          block: mergedBlock,
          blockIndex,
          listItemIndex: undefined,
        }),
        focus: positionFromAbsoluteOffset({
          absoluteOffset: cursorAbsolute,
          block: mergedBlock,
          blockIndex,
          listItemIndex: undefined,
        }),
      };
    return commit(state, { ...state.document, children: nextChildren }, selection);
  },
  positionsEqual = (left: Position, right: Position): boolean =>
    left.blockIndex === right.blockIndex &&
    left.inlineIndex === right.inlineIndex &&
    left.offset === right.offset &&
    left.listItemIndex === right.listItemIndex,
  workDeleteBackwardCollapsed = (
    state: State,
    inlineRange: SelectedInlineRange,
  ): State => {
    if (inlineRange.start === emptyIndex) {
      return joinBlockBackward(state, inlineRange);
    }
    return deleteInlineRange(state, {
      ...inlineRange,
      end: inlineRange.start,
      start: inlineRange.start - firstIndex,
    });
  },
  workDeleteForwardCollapsed = (
    state: State,
    inlineRange: SelectedInlineRange,
  ): State => {
    if (inlineRange.start >= inlineBlockTextLength(inlineRange.block)) {
      return joinBlockForward(state, inlineRange);
    }
    return deleteInlineRange(state, {
      ...inlineRange,
      end: inlineRange.start + firstIndex,
    });
  };

export default { deleteSelection };
