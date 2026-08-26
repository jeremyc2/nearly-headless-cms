import { emptyIndex, firstIndex } from "./transactions-constants.ts";
import type { RichText } from "nearly-headless-cms";
import type { State } from "./transactions-types.ts";
import { selectedText } from "./transactions-selection.ts";
import transactionsMarks from "./transactions-marks.ts";
import transactionsState from "./transactions-state.ts";
import transactionsSupport from "./transactions-support.ts";

const { marksForNextInput, toggleMarkInSet } = transactionsMarks,
  { commit, replaceBlock } = transactionsState,
  { canonicalMarks, conditionalValue, marksProperty } = transactionsSupport,
  buildTextSegment = (text: string, marks: readonly RichText.Mark[]): RichText.TextNode => ({
    text,
    type: "text",
    ...marksProperty(marks),
  }),
  insertTextSegmentsForSelection = (
    selected: NonNullable<ReturnType<typeof selectedText>>,
    text: string,
    insertMarks: readonly RichText.Mark[],
  ): readonly RichText.InlineNode[] => {
    const nodeMarks = selected.text.marks ?? [],
      before = selected.text.text.slice(emptyIndex, selected.start),
      after = selected.text.text.slice(selected.end),
      segments: RichText.InlineNode[] = [];
    if (before.length > emptyIndex) {
      segments.push(buildTextSegment(before, nodeMarks));
    }
    if (text.length > emptyIndex) {
      segments.push(buildTextSegment(text, insertMarks));
    }
    if (after.length > emptyIndex) {
      segments.push(buildTextSegment(after, nodeMarks));
    }
    if (segments.length === emptyIndex) {
      segments.push(buildTextSegment("", insertMarks));
    }
    return segments;
  },
  buildMarkedTextSegments = (
    selected: NonNullable<ReturnType<typeof selectedText>>,
    activeMarks: readonly RichText.Mark[],
    nextMarks: readonly RichText.Mark[],
  ): RichText.TextNode[] => [
    ...conditionalValue(
      selected.start === emptyIndex,
      [],
      [
        {
          text: selected.text.text.slice(emptyIndex, selected.start),
          type: "text" as const,
          ...conditionalValue(activeMarks.length === emptyIndex, {}, { marks: activeMarks }),
        },
      ],
    ),
    {
      text: selected.text.text.slice(selected.start, selected.end),
      type: "text",
      ...conditionalValue(nextMarks.length === emptyIndex, {}, { marks: nextMarks }),
    },
    ...conditionalValue(
      selected.end === selected.text.text.length,
      [],
      [
        {
          text: selected.text.text.slice(selected.end),
          type: "text" as const,
          ...conditionalValue(activeMarks.length === emptyIndex, {}, { marks: activeMarks }),
        },
      ],
    ),
  ],
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
    const selected = selectedText(state);
    if (selected === undefined) {
      return state;
    }
    return workInsertTextForSelection(state, selected, text);
  },
  splitBlock = (state: State): State => {
    const selected = selectedText(state);
    if (selected === undefined) {
      return state;
    }
    return workSplitBlockForSelection(state, selected);
  },
  splitListBlock = <
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-201] React panel helpers preserve local prop aliases for component call sites.
    Input extends {
      before: RichText.TextNode;
      listBlock: RichText.ListNode;
      secondBlock: RichText.ParagraphNode;
      state: State;
    },
  >({
    before,
    listBlock,
    secondBlock,
    state,
  }: Readonly<Input>): State => {
    const listItemIndex = state.selection.anchor.listItemIndex ?? emptyIndex,
      nextList: RichText.ListNode = {
        ...listBlock,
        children: listBlock.children.flatMap((listItem, index) =>
          conditionalValue(
            index === listItemIndex,
            [
              { children: [{ ...secondBlock, children: [before] }], type: "list-item" as const },
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
    const selected = selectedText(state);
    if (selected === undefined) {
      return state;
    }
    if (selected.start === selected.end) {
      return {
        ...state,
        storedMarks: toggleMarkInSet(marksForNextInput(state), mark),
      };
    }
    return workToggleMarkForSelection(state, selected, mark);
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
  workInsertTextForSelection = (
    state: State,
    selected: NonNullable<ReturnType<typeof selectedText>>,
    text: string,
  ): State => {
    const insertMarks = marksForNextInput(state),
      position = state.selection.anchor,
      segments = insertTextSegmentsForSelection(selected, text, insertMarks),
      beforeSegmentCount = conditionalValue(
        selected.text.text.slice(emptyIndex, selected.start).length > emptyIndex,
        firstIndex,
        emptyIndex,
      ),
      updatedChildren = selected.block.children.flatMap((node, index) =>
        conditionalValue(index === position.inlineIndex, segments, [node]),
      ),
      nextInlineIndex = position.inlineIndex + beforeSegmentCount,
      nextOffset = conditionalValue(text.length > emptyIndex, text.length, emptyIndex),
      selection = {
        anchor: { ...position, inlineIndex: nextInlineIndex, offset: nextOffset },
        focus: { ...position, inlineIndex: nextInlineIndex, offset: nextOffset },
      };
    return commit(
      state,
      replaceBlock(
        state.document,
        position.blockIndex,
        selected.replace({ ...selected.block, children: updatedChildren }),
      ),
      selection,
    );
  },
  workSplitBlockForSelection = (
    state: State,
    selected: NonNullable<ReturnType<typeof selectedText>>,
  ): State => {
    const after: RichText.TextNode = {
        ...selected.text,
        text: selected.text.text.slice(selected.end),
      },
      before: RichText.TextNode = {
        ...selected.text,
        text: selected.text.text.slice(emptyIndex, selected.start),
      },
      firstBlock = { ...selected.block, children: [before] } as
        | RichText.ParagraphNode
        | RichText.HeadingNode,
      secondBlock: RichText.ParagraphNode = { children: [after], type: "paragraph" };
    if (
      selected.rootBlock.type === "ordered-list" ||
      selected.rootBlock.type === "unordered-list"
    ) {
      return splitListBlock({
        before,
        listBlock: selected.rootBlock,
        secondBlock,
        state,
      });
    }
    return splitRootBlock({ firstBlock, secondBlock, state });
  },
  workToggleMarkForSelection = (
    state: State,
    selected: NonNullable<ReturnType<typeof selectedText>>,
    mark: RichText.Mark,
  ): State => {
    const activeMarks = selected.text.marks ?? [],
      nextMarks = conditionalValue(
        activeMarks.includes(mark),
        activeMarks.filter((candidate) => candidate !== mark),
        canonicalMarks([...activeMarks, mark]),
      ),
      replacement = buildMarkedTextSegments(selected, activeMarks, nextMarks),
      updatedChildren = selected.block.children.flatMap((node, index) =>
        conditionalValue(index === state.selection.anchor.inlineIndex, replacement, [node]),
      );
    return {
      ...commit(
        state,
        replaceBlock(
          state.document,
          state.selection.anchor.blockIndex,
          selected.replace({ ...selected.block, children: updatedChildren }),
        ),
      ),
      storedMarks: null,
    };
  };

export default { insertReference, insertText, splitBlock, toggleMark };
