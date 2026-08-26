import { emptyIndex, firstIndex } from "./transactions-constants.ts";
import type { Position, Selection } from "./transactions-types.ts";
import type { RichText } from "nearly-headless-cms";

const absoluteOffsetInBlock = (
    block: RichText.ParagraphNode | RichText.HeadingNode,
    inlineIndex: number,
    offset: number,
  ): number => {
    let absolute = emptyIndex;
    for (let index = emptyIndex; index < inlineIndex; index++) {
      const child = block.children[index];
      if (child?.type === "text") {
        absolute += child.text.length;
      }
    }
    const child = block.children[inlineIndex];
    if (child?.type === "text") {
      absolute += Math.min(offset, child.text.length);
    }
    return absolute;
  },
  inlineBlockTextLength = (block: RichText.ParagraphNode | RichText.HeadingNode): number => {
    let length = emptyIndex;
    for (const child of block.children) {
      if (child.type === "text") {
        length += child.text.length;
      }
    }
    return length;
  },
  positionAtInlineBlockEnd = (
    blockIndex: number,
    block: RichText.ParagraphNode | RichText.HeadingNode,
    listItemIndex?: number,
  ): Position => {
    const inlineIndex = lastTextInlineIndex(block),
      child = block.children[inlineIndex];
    return {
      blockIndex,
      inlineIndex,
      offset: child?.type === "text" ? child.text.length : emptyIndex,
      ...(listItemIndex === undefined ? {} : { listItemIndex }),
    };
  },
  documentEndPositionFromList = (
    blockIndex: number,
    rootBlock: RichText.ListNode,
  ): Position | undefined => {
    const listItemIndex = rootBlock.children.length - firstIndex,
      listItem = rootBlock.children[listItemIndex],
      paragraph = listItem?.children[listItem.children.length - firstIndex];
    if (paragraph?.type !== "paragraph") {
      return undefined;
    }
    return positionAtInlineBlockEnd(blockIndex, paragraph, listItemIndex);
  },
  documentEndPosition = (document: RichText.Document): Position => {
    for (
      let blockIndex = document.children.length - firstIndex;
      blockIndex >= emptyIndex;
      blockIndex--
    ) {
      const rootBlock = document.children[blockIndex];
      if (rootBlock?.type === "paragraph" || rootBlock?.type === "heading") {
        return positionAtInlineBlockEnd(blockIndex, rootBlock);
      }
      if (rootBlock?.type === "ordered-list" || rootBlock?.type === "unordered-list") {
        const listEnd = documentEndPositionFromList(blockIndex, rootBlock);
        if (listEnd !== undefined) {
          return listEnd;
        }
      }
    }
    return { blockIndex: emptyIndex, inlineIndex: emptyIndex, offset: emptyIndex };
  },
  lastTextInlineIndex = (block: RichText.ParagraphNode | RichText.HeadingNode): number => {
    for (let index = block.children.length - firstIndex; index >= emptyIndex; index--) {
      if (block.children[index]?.type === "text") {
        return index;
      }
    }
    return emptyIndex;
  },
  listItemProperty = (
    listItemIndex: number | undefined,
  ): { readonly listItemIndex?: number } =>
    listItemIndex === undefined ? {} : { listItemIndex },
  positionFromAbsoluteOffset = (input: {
    readonly absoluteOffset: number;
    readonly block: RichText.ParagraphNode | RichText.HeadingNode;
    readonly blockIndex: number;
    readonly listItemIndex: number | undefined;
  }): Position => {
    const { absoluteOffset, block, blockIndex, listItemIndex } = input;
    let remaining = absoluteOffset;
    for (let inlineIndex = emptyIndex; inlineIndex < block.children.length; inlineIndex++) {
      const child = block.children[inlineIndex];
      if (child?.type === "text") {
        if (remaining <= child.text.length) {
          return {
            blockIndex,
            inlineIndex,
            offset: remaining,
            ...listItemProperty(listItemIndex),
          };
        }
        remaining -= child.text.length;
      }
    }
    const inlineIndex = lastTextInlineIndex(block),
      child = block.children[inlineIndex],
      offset = child?.type === "text" ? child.text.length : emptyIndex;
    return {
      blockIndex,
      inlineIndex,
      offset,
      ...listItemProperty(listItemIndex),
    };
  },
  reconcileSelection = (input: {
    readonly normalizedDocument: RichText.Document;
    readonly resolveInlineBlock: (
      rootBlock: RichText.BlockNode,
      listItemIndex: number,
    ) => RichText.ParagraphNode | RichText.HeadingNode | undefined;
    readonly selection: Selection;
    readonly sourceDocument: RichText.Document;
  }): Selection => {
    const { normalizedDocument, resolveInlineBlock, selection, sourceDocument } = input,
      reconcilePosition = (position: Position): Position => {
      const sourceRoot = sourceDocument.children[position.blockIndex],
        normalizedRoot = normalizedDocument.children[position.blockIndex];
      if (sourceRoot === undefined || normalizedRoot === undefined) {
        return position;
      }
      const sourceBlock = resolveInlineBlock(sourceRoot, position.listItemIndex ?? emptyIndex),
        normalizedBlock = resolveInlineBlock(normalizedRoot, position.listItemIndex ?? emptyIndex);
      if (sourceBlock === undefined || normalizedBlock === undefined) {
        return position;
      }
      return positionFromAbsoluteOffset({
        absoluteOffset: absoluteOffsetInBlock(
          sourceBlock,
          position.inlineIndex,
          position.offset,
        ),
        block: normalizedBlock,
        blockIndex: position.blockIndex,
        listItemIndex: position.listItemIndex,
      });
    };
    return {
      anchor: reconcilePosition(selection.anchor),
      focus: reconcilePosition(selection.focus),
    };
  };

export default {
  absoluteOffsetInBlock,
  documentEndPosition,
  inlineBlockTextLength,
  positionFromAbsoluteOffset,
  reconcileSelection,
};
