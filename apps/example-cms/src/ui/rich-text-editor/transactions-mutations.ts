import { emptyIndex, firstIndex } from "./transactions-constants.ts";
import type { RichText } from "nearly-headless-cms";
import type { State } from "./transactions-types.ts";
import { selectedText } from "./transactions-selection.ts";
import transactionsState from "./transactions-state.ts";
import transactionsSupport from "./transactions-support.ts";

const { commit, replaceBlock } = transactionsState,
  { canonicalMarks, conditionalValue, replaceInlineNode } = transactionsSupport,
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
  resolveInsertMarks = (
    selected: NonNullable<ReturnType<typeof selectedText>>,
    pendingMarks: readonly RichText.Mark[],
  ): { readonly marks?: readonly RichText.Mark[] } => {
    if ((selected.text.marks?.length ?? emptyIndex) > emptyIndex) {
      return { marks: selected.text.marks };
    }
    if (pendingMarks.length > emptyIndex) {
      return { marks: pendingMarks };
    }
    return {};
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
    if (selected === undefined || selected.start === selected.end) {
      const pendingMarks = conditionalValue(
        state.pendingMarks.includes(mark),
        state.pendingMarks.filter((candidate) => candidate !== mark),
        canonicalMarks([...state.pendingMarks, mark]),
      );
      return { ...state, pendingMarks };
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
    const block = {
        ...selected.block,
        children: selected.block.children.map((node, index) =>
          replaceInlineNode({
            index,
            node,
            replacement: {
              text: `${selected.text.text.slice(emptyIndex, selected.start)}${text}${selected.text.text.slice(selected.end)}`,
              type: "text",
              ...resolveInsertMarks(selected, state.pendingMarks),
            },
            targetIndex: state.selection.anchor.inlineIndex,
          }),
        ),
      } as RichText.ParagraphNode | RichText.HeadingNode,
      offset = selected.start + text.length,
      position = state.selection.anchor,
      selection = { anchor: { ...position, offset }, focus: { ...position, offset } };
    return commit(
      state,
      replaceBlock(state.document, position.blockIndex, selected.replace(block)),
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
    return commit(
      state,
      replaceBlock(
        state.document,
        state.selection.anchor.blockIndex,
        selected.replace({ ...selected.block, children: updatedChildren }),
      ),
    );
  };

export default { insertReference, insertText, splitBlock, toggleMark };
