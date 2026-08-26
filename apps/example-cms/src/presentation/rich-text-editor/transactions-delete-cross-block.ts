import { emptyIndex, firstIndex } from "./transactions-constants.ts";
import type { Position, State } from "./transactions-types.ts";
import type { RichText } from "nearly-headless-cms";
import transactionsInlineEdit from "./transactions-inline-edit.ts";
import transactionsSelection from "./transactions-selection.ts";
import transactionsSelectionOffset from "./transactions-selection-offset.ts";
import transactionsState from "./transactions-state.ts";

const { splitInlineBlockAtOffset } = transactionsInlineEdit,
  { positionFromAbsoluteOffset } = transactionsSelectionOffset,
  { commit } = transactionsState,
  buildMergedBlock = (input: {
    readonly endRootBlock: RichText.BlockNode;
    readonly mergedChildren: readonly RichText.InlineNode[];
    readonly startRootBlock: RichText.BlockNode;
  }): RichText.ParagraphNode | RichText.HeadingNode => {
    const { endRootBlock, mergedChildren, startRootBlock } = input,
      children =
        mergedChildren.length === emptyIndex
          ? [{ text: "", type: "text" as const }]
          : mergedChildren;
    if (startRootBlock.type === "heading" && endRootBlock.type === "heading") {
      return { ...startRootBlock, children };
    }
    return { children, type: "paragraph" };
  },
  resolveSelectionPosition = (
    state: State,
    position: Position,
  ):
    | {
        readonly absoluteOffset: number;
        readonly block: RichText.ParagraphNode | RichText.HeadingNode;
        readonly rootBlock: RichText.BlockNode;
      }
    | undefined => {
    const rootBlock = state.document.children[position.blockIndex];
    if (rootBlock === undefined) {
      return undefined;
    }
    const resolved = transactionsSelection.resolveSelectedBlock(
      rootBlock,
      position.listItemIndex ?? emptyIndex,
    );
    if (resolved === undefined) {
      return undefined;
    }
    return {
      absoluteOffset: transactionsSelectionOffset.absoluteOffsetInBlock(
        resolved.block,
        position.inlineIndex,
        position.offset,
      ),
      block: resolved.block,
      rootBlock,
    };
  },
  crossBlockDeleteSelection = (input: {
    readonly cursorAbsolute: number;
    readonly mergedBlock: RichText.ParagraphNode | RichText.HeadingNode;
    readonly range: { readonly end: Position; readonly start: Position };
  }) => ({
    anchor: positionFromAbsoluteOffset({
      absoluteOffset: input.cursorAbsolute,
      block: input.mergedBlock,
      blockIndex: input.range.start.blockIndex,
      listItemIndex: input.range.start.listItemIndex,
    }),
    focus: positionFromAbsoluteOffset({
      absoluteOffset: input.cursorAbsolute,
      block: input.mergedBlock,
      blockIndex: input.range.start.blockIndex,
      listItemIndex: input.range.start.listItemIndex,
    }),
  }),
  workDeleteCrossBlockRange = (
    state: State,
    range: {
      readonly end: Position;
      readonly start: Position;
    },
  ): State => {
    const startContext = resolveSelectionPosition(state, range.start),
      endContext = resolveSelectionPosition(state, range.end);
    if (startContext === undefined || endContext === undefined) {
      return state;
    }
    const { after: endSuffix } = splitInlineBlockAtOffset(
        endContext.block,
        endContext.absoluteOffset,
      ),
      { before: startPrefix } = splitInlineBlockAtOffset(
        startContext.block,
        startContext.absoluteOffset,
      ),
      mergedChildren: readonly RichText.InlineNode[] = [...startPrefix, ...endSuffix],
      mergedBlock = buildMergedBlock({
        endRootBlock: endContext.rootBlock,
        mergedChildren,
        startRootBlock: startContext.rootBlock,
      }),
      cursorAbsolute = startPrefix.reduce(
        (length, child) => length + (child.type === "text" ? child.text.length : emptyIndex),
        emptyIndex,
      );
    return commit(
      state,
      {
        ...state.document,
        children: [
          ...state.document.children.slice(emptyIndex, range.start.blockIndex),
          mergedBlock,
          ...state.document.children.slice(range.end.blockIndex + firstIndex),
        ],
      },
      crossBlockDeleteSelection({ cursorAbsolute, mergedBlock, range }),
    );
  };

export default { buildMergedBlock, workDeleteCrossBlockRange };
