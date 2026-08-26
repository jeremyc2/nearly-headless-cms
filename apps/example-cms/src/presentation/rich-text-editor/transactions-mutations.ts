import { emptyIndex, firstIndex } from "./transactions-constants.ts";
import type { RichText } from "nearly-headless-cms";
import type { State } from "./transactions-types.ts";
import transactionsInlineEdit from "./transactions-inline-edit.ts";
import transactionsMarks from "./transactions-marks.ts";
import transactionsSelection from "./transactions-selection.ts";
import transactionsSelectionOffset from "./transactions-selection-offset.ts";
import transactionsState from "./transactions-state.ts";
import transactionsSupport from "./transactions-support.ts";

const {
    rebuildBlockWithMarkToggle,
    rebuildBlockWithRangeReplacement,
    splitInlineBlockAtOffset,
  } = transactionsInlineEdit,
  { marksForNextInput, toggleMarkInSet } = transactionsMarks,
  { selectedInlineRange, selectedText } = transactionsSelection,
  { positionFromAbsoluteOffset } = transactionsSelectionOffset,
  { commit, replaceBlock } = transactionsState,
  { conditionalValue } = transactionsSupport,
  deleteInlineRange = (
    state: State,
    inlineRange: NonNullable<ReturnType<typeof selectedInlineRange>>,
  ): State => workInsertTextForInlineRange(state, inlineRange, ""),
  insertReference = (
    state: State,
    reference: RichText.EntryReferenceNode | RichText.LinkNode,
  ): State => {
    const selected = selectedText(state);
    if (selected === undefined) {
      return state;
    }
    return workInsertReferenceForSelection(state, selected, reference);
  },
  insertText = (state: State, text: string): State => {
    const inlineRange = selectedInlineRange(state);
    if (inlineRange === undefined) {
      return state;
    }
    return workInsertTextForInlineRange(state, inlineRange, text);
  },
  splitBlock = (state: State): State => {
    const inlineRange = selectedInlineRange(state);
    if (inlineRange === undefined || inlineRange.start !== inlineRange.end) {
      return state;
    }
    return workSplitBlockAtOffset(state, inlineRange, inlineRange.start);
  },
  splitListBlock = <
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-201] React panel helpers preserve local prop aliases for component call sites.
    Input extends {
      firstBlock: RichText.ParagraphNode | RichText.HeadingNode;
      listBlock: RichText.ListNode;
      secondBlock: RichText.ParagraphNode;
      state: State;
    },
  >({
    firstBlock,
    listBlock,
    secondBlock,
    state,
  }: Readonly<Input>): State => {
    const listItemIndex = state.selection.anchor.listItemIndex ?? emptyIndex,
      firstParagraph: RichText.ParagraphNode =
        firstBlock.type === "paragraph"
          ? firstBlock
          : { children: firstBlock.children, type: "paragraph" },
      nextList: RichText.ListNode = {
        ...listBlock,
        children: listBlock.children.flatMap((listItem, index) =>
          conditionalValue(
            index === listItemIndex,
            [
              { children: [firstParagraph], type: "list-item" as const },
              { children: [secondBlock], type: "list-item" as const },
            ],
            [listItem],
          ),
        ),
      },
      nextPosition = {
        blockIndex: state.selection.anchor.blockIndex,
        inlineIndex: emptyIndex,
        listItemIndex: listItemIndex + firstIndex,
        offset: emptyIndex,
      };
    return commit(
      state,
      replaceBlock(state.document, state.selection.anchor.blockIndex, nextList),
      { anchor: nextPosition, focus: nextPosition },
    );
  },
  splitRootBlock = <
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-201] React panel helpers preserve local prop aliases for component call sites.
    Input extends {
      firstBlock: RichText.ParagraphNode | RichText.HeadingNode;
      secondBlock: RichText.ParagraphNode;
      state: State;
    },
  >({
    firstBlock,
    secondBlock,
    state,
  }: Readonly<Input>): State => {
    const children = [
        ...state.document.children.slice(emptyIndex, state.selection.anchor.blockIndex),
        firstBlock,
        secondBlock,
        ...state.document.children.slice(state.selection.anchor.blockIndex + firstIndex),
      ],
      nextPosition = {
        blockIndex: state.selection.anchor.blockIndex + firstIndex,
        inlineIndex: emptyIndex,
        offset: emptyIndex,
      };
    return commit(
      state,
      { ...state.document, children },
      { anchor: nextPosition, focus: nextPosition },
    );
  },
  toggleMark = (state: State, mark: RichText.Mark): State => {
    const inlineRange = selectedInlineRange(state);
    if (inlineRange === undefined) {
      return state;
    }
    if (inlineRange.start === inlineRange.end) {
      return {
        ...state,
        storedMarks: toggleMarkInSet(marksForNextInput(state), mark),
      };
    }
    return workToggleMarkForInlineRange(state, inlineRange, mark);
  },
  workInsertReferenceForSelection = (
    state: State,
    selected: NonNullable<ReturnType<typeof selectedText>>,
    reference: RichText.EntryReferenceNode | RichText.LinkNode,
  ): State => {
    const after = selected.text.text.slice(selected.end),
      before = selected.text.text.slice(emptyIndex, selected.start),
      position = state.selection.anchor,
      replacement: RichText.InlineNode[] = [
        ...conditionalValue(before.length === emptyIndex, [], [{ ...selected.text, text: before }]),
        reference,
        ...conditionalValue(after.length === emptyIndex, [], [{ ...selected.text, text: after }]),
      ],
      updatedChildren = selected.block.children.flatMap((node, index) =>
        conditionalValue(index === position.inlineIndex, replacement, [node]),
      );
    return commit(
      state,
      replaceBlock(
        state.document,
        position.blockIndex,
        selected.replace({ ...selected.block, children: updatedChildren }),
      ),
    );
  },
  workInsertTextForInlineRange = (
    state: State,
    inlineRange: NonNullable<ReturnType<typeof selectedInlineRange>>,
    text: string,
  ): State => {
    const insertMarks = marksForNextInput(state),
      { anchor } = state.selection,
      updatedChildren = rebuildBlockWithRangeReplacement({
        block: inlineRange.block,
        rangeEnd: inlineRange.end,
        rangeStart: inlineRange.start,
        replacementMarks: insertMarks,
        replacementText: text,
      }),
      updatedBlock = { ...inlineRange.block, children: updatedChildren },
      cursorAbsolute = inlineRange.start + text.length,
      selection = {
        anchor: positionFromAbsoluteOffset({
          absoluteOffset: cursorAbsolute,
          block: updatedBlock,
          blockIndex: anchor.blockIndex,
          listItemIndex: anchor.listItemIndex,
        }),
        focus: positionFromAbsoluteOffset({
          absoluteOffset: cursorAbsolute,
          block: updatedBlock,
          blockIndex: anchor.blockIndex,
          listItemIndex: anchor.listItemIndex,
        }),
      };
    return commit(
      state,
      replaceBlock(
        state.document,
        anchor.blockIndex,
        inlineRange.replace(updatedBlock),
      ),
      selection,
    );
  },
  workSplitBlockAtOffset = (
    state: State,
    inlineRange: NonNullable<ReturnType<typeof selectedInlineRange>>,
    splitAt: number,
  ): State => {
    const { after, before } = splitInlineBlockAtOffset(inlineRange.block, splitAt),
      firstBlock =
        inlineRange.block.type === "heading"
          ? ({ ...inlineRange.block, children: before } as RichText.HeadingNode)
          : ({ children: before, type: "paragraph" } as RichText.ParagraphNode),
      secondBlock: RichText.ParagraphNode = { children: after, type: "paragraph" };
    if (
      inlineRange.rootBlock.type === "ordered-list" ||
      inlineRange.rootBlock.type === "unordered-list"
    ) {
      return splitListBlock({
        firstBlock,
        listBlock: inlineRange.rootBlock,
        secondBlock,
        state,
      });
    }
    return splitRootBlock({ firstBlock, secondBlock, state });
  },
  workToggleMarkForInlineRange = (
    state: State,
    inlineRange: NonNullable<ReturnType<typeof selectedInlineRange>>,
    mark: RichText.Mark,
  ): State => {
    const { anchor, focus } = state.selection,
      updatedChildren = rebuildBlockWithMarkToggle({
        block: inlineRange.block,
        mark,
        rangeEnd: inlineRange.end,
        rangeStart: inlineRange.start,
      }),
      updatedBlock = { ...inlineRange.block, children: updatedChildren },
      selection = {
        anchor: positionFromAbsoluteOffset({
          absoluteOffset: inlineRange.start,
          block: updatedBlock,
          blockIndex: anchor.blockIndex,
          listItemIndex: anchor.listItemIndex,
        }),
        focus: positionFromAbsoluteOffset({
          absoluteOffset: inlineRange.end,
          block: updatedBlock,
          blockIndex: focus.blockIndex,
          listItemIndex: focus.listItemIndex,
        }),
      };
    return {
      ...commit(
        state,
        replaceBlock(
          state.document,
          anchor.blockIndex,
          inlineRange.replace(updatedBlock),
        ),
        selection,
      ),
      storedMarks: null,
    };
  };

export default { deleteInlineRange, insertReference, insertText, splitBlock, toggleMark };
