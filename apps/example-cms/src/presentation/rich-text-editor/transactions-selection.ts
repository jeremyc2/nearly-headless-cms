import { emptyIndex, firstIndex } from "./transactions-constants.ts";
import type { RichText } from "nearly-headless-cms";
import type { Position, State } from "./transactions-types.ts";
import transactionsSelectionOffset from "./transactions-selection-offset.ts";
import transactionsSupport from "./transactions-support.ts";

const { absoluteOffsetInBlock } = transactionsSelectionOffset,
  { asParagraph, conditionalValue } = transactionsSupport,
  compareDocumentPositions = (
    state: State,
    left: Position,
    right: Position,
  ): number => {
    if (left.blockIndex !== right.blockIndex) {
      return left.blockIndex - right.blockIndex;
    }
    const leftListItemIndex = left.listItemIndex ?? emptyIndex,
      rightListItemIndex = right.listItemIndex ?? emptyIndex;
    if (leftListItemIndex !== rightListItemIndex) {
      return leftListItemIndex - rightListItemIndex;
    }
    const leftBlock = resolveInlineBlockAtPosition(state.document, left),
      rightBlock = resolveInlineBlockAtPosition(state.document, right);
    if (leftBlock === undefined || rightBlock === undefined) {
      return emptyIndex;
    }
    return (
      absoluteOffsetInBlock(leftBlock, left.inlineIndex, left.offset) -
      absoluteOffsetInBlock(rightBlock, right.inlineIndex, right.offset)
    );
  },
  resolveListInlineBlock = (
    rootBlock: RichText.ListNode,
    listItemIndex: number,
  ):
    | {
        readonly block: RichText.ParagraphNode | RichText.HeadingNode;
        readonly replace: (
          replacement: RichText.ParagraphNode | RichText.HeadingNode,
        ) => RichText.BlockNode;
      }
    | undefined => {
    const listItem = rootBlock.children[listItemIndex],
      paragraph = listItem?.children[emptyIndex];
    if (paragraph?.type !== "paragraph") {
      return undefined;
    }
    return {
      block: paragraph,
      replace: (replacement) => ({
        ...rootBlock,
        children: rootBlock.children.map((candidate, index) =>
          conditionalValue(
            index === listItemIndex,
            {
              ...candidate,
              children: [asParagraph(replacement), ...candidate.children.slice(firstIndex)],
            },
            candidate,
          ),
        ),
      }),
    };
  },
  resolveQuoteInlineBlock = (
    rootBlock: RichText.QuoteNode,
  ):
    | {
        readonly block: RichText.ParagraphNode | RichText.HeadingNode;
        readonly replace: (
          replacement: RichText.ParagraphNode | RichText.HeadingNode,
        ) => RichText.BlockNode;
      }
    | undefined => {
    const [paragraph] = rootBlock.children;
    if (paragraph === undefined) {
      return undefined;
    }
    return {
      block: paragraph,
      replace: (replacement) => ({
        ...rootBlock,
        children: [asParagraph(replacement), ...rootBlock.children.slice(firstIndex)],
      }),
    };
  },
  resolveSelectedBlock = (
    rootBlock: RichText.BlockNode,
    listItemIndex: number,
  ):
    | {
        readonly block: RichText.ParagraphNode | RichText.HeadingNode;
        readonly replace: (
          replacement: RichText.ParagraphNode | RichText.HeadingNode,
        ) => RichText.BlockNode;
      }
    | undefined => {
    if (rootBlock.type === "paragraph" || rootBlock.type === "heading") {
      return { block: rootBlock, replace: (replacement) => replacement };
    }
    if (rootBlock.type === "quote") {
      return resolveQuoteInlineBlock(rootBlock);
    }
    if (rootBlock.type === "ordered-list" || rootBlock.type === "unordered-list") {
      return resolveListInlineBlock(rootBlock, listItemIndex);
    }
    return undefined;
  },
  resolveInlineBlockAtPosition = (
    document: RichText.Document,
    position: State["selection"]["anchor"],
  ): RichText.ParagraphNode | RichText.HeadingNode | undefined => {
    const rootBlock = document.children[position.blockIndex];
    if (rootBlock === undefined) {
      return undefined;
    }
    return resolveSelectedBlock(rootBlock, position.listItemIndex ?? emptyIndex)?.block;
  },
  resolveInlineRangeBounds = (
    anchor: State["selection"]["anchor"],
    block: RichText.ParagraphNode | RichText.HeadingNode,
    focus: State["selection"]["focus"],
  ): { readonly end: number; readonly start: number } => ({
    end: Math.max(
      absoluteOffsetInBlock(block, anchor.inlineIndex, anchor.offset),
      absoluteOffsetInBlock(block, focus.inlineIndex, focus.offset),
    ),
    start: Math.min(
      absoluteOffsetInBlock(block, anchor.inlineIndex, anchor.offset),
      absoluteOffsetInBlock(block, focus.inlineIndex, focus.offset),
    ),
  }),
  readSelectedInlineRangeContext = (
    state: State,
  ):
    | {
        readonly anchor: State["selection"]["anchor"];
        readonly focus: State["selection"]["focus"];
        readonly replace: (
          block: RichText.ParagraphNode | RichText.HeadingNode,
        ) => RichText.BlockNode;
        readonly resolvedBlock: RichText.ParagraphNode | RichText.HeadingNode;
        readonly rootBlock: RichText.BlockNode;
      }
    | undefined => {
    const { anchor, focus } = state.selection;
    if (
      anchor.blockIndex !== focus.blockIndex ||
      anchor.listItemIndex !== focus.listItemIndex
    ) {
      return undefined;
    }
    const rootBlock = state.document.children[anchor.blockIndex];
    if (rootBlock === undefined) {
      return undefined;
    }
    const resolved = resolveSelectedBlock(rootBlock, anchor.listItemIndex ?? emptyIndex);
    if (resolved === undefined) {
      return undefined;
    }
    return {
      anchor,
      focus,
      replace: resolved.replace,
      resolvedBlock: resolved.block,
      rootBlock,
    };
  },
  readSelectedCrossBlockRange = (
    state: State,
  ):
    | {
        readonly end: Position;
        readonly start: Position;
      }
    | undefined => {
    const { anchor, focus } = state.selection;
    if (
      anchor.blockIndex === focus.blockIndex &&
      anchor.listItemIndex === focus.listItemIndex
    ) {
      return undefined;
    }
    if (compareDocumentPositions(state, anchor, focus) <= emptyIndex) {
      return { end: focus, start: anchor };
    }
    return { end: anchor, start: focus };
  },
  selectedInlineRange = (
    state: State,
  ):
    | {
        readonly block: RichText.ParagraphNode | RichText.HeadingNode;
        readonly end: number;
        readonly replace: (
          block: RichText.ParagraphNode | RichText.HeadingNode,
        ) => RichText.BlockNode;
        readonly rootBlock: RichText.BlockNode;
        readonly start: number;
      }
    | undefined => {
    const context = readSelectedInlineRangeContext(state);
    if (context === undefined) {
      return undefined;
    }
    const bounds = resolveInlineRangeBounds(
      context.anchor,
      context.resolvedBlock,
      context.focus,
    );
    return {
      block: context.resolvedBlock,
      end: bounds.end,
      replace: context.replace,
      rootBlock: context.rootBlock,
      start: bounds.start,
    };
  },
  locateTextAtAbsoluteOffset = (
    block: RichText.ParagraphNode | RichText.HeadingNode,
    absoluteOffset: number,
  ):
    | {
        readonly inlineIndex: number;
        readonly offset: number;
        readonly text: RichText.TextNode;
      }
    | undefined => {
    let remaining = absoluteOffset;
    for (let inlineIndex = emptyIndex; inlineIndex < block.children.length; inlineIndex++) {
      const child = block.children[inlineIndex];
      if (child?.type === "text") {
        if (remaining <= child.text.length) {
          return { inlineIndex, offset: remaining, text: child };
        }
        remaining -= child.text.length;
      }
    }
    return undefined;
  },
  selectedText = (
    state: State,
  ):
    | {
        readonly block: RichText.ParagraphNode | RichText.HeadingNode;
        readonly end: number;
        readonly replace: (
          block: RichText.ParagraphNode | RichText.HeadingNode,
        ) => RichText.BlockNode;
        readonly rootBlock: RichText.BlockNode;
        readonly start: number;
        readonly text: RichText.TextNode;
      }
    | undefined => {
    const inlineRange = selectedInlineRange(state);
    if (inlineRange === undefined || inlineRange.start !== inlineRange.end) {
      return undefined;
    }
    const located = locateTextAtAbsoluteOffset(inlineRange.block, inlineRange.start);
    if (located === undefined) {
      return undefined;
    }
    return {
      block: inlineRange.block,
      end: located.offset,
      replace: inlineRange.replace,
      rootBlock: inlineRange.rootBlock,
      start: located.offset,
      text: located.text,
    };
  };

export type SelectedInlineRange = NonNullable<ReturnType<typeof selectedInlineRange>>;
export type SelectedTextContext = NonNullable<ReturnType<typeof selectedText>>;
export default {
  locateTextAtAbsoluteOffset,
  readSelectedCrossBlockRange,
  readSelectedInlineRangeContext,
  resolveInlineBlockAtPosition,
  resolveSelectedBlock,
  selectedInlineRange,
  selectedText,
};
