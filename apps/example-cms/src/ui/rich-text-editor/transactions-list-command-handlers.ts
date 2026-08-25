import { type Command, type State } from "./transactions-types.ts";
import { type SelectedTextContext, selectedText } from "./transactions-selection.ts";
import { emptyIndex, firstIndex } from "./transactions-constants.ts";
import type { RichText } from "nearly-headless-cms";
import transactionsMutations from "./transactions-mutations.ts";
import transactionsState from "./transactions-state.ts";
import transactionsSupport from "./transactions-support.ts";

const { commit, replaceBlock } = transactionsState,
  { conditionalValue } = transactionsSupport,
  applyDeleteBackward = (state: State): State => {
    const selected = selectedText(state);
    if (selected === undefined) {
      return state;
    }
    if (
      selected.start === emptyIndex &&
      selected.end === emptyIndex &&
      (selected.rootBlock.type === "ordered-list" || selected.rootBlock.type === "unordered-list")
    ) {
      return workDeleteBackwardAtListStart(state, selected);
    }
    return workDeleteBackwardForSelection(state, selected);
  },
  applyToggleList = (
    state: State,
    command: Extract<Command, { type: "toggleList" }>,
  ): State => {
    const rootBlock = state.document.children[state.selection.anchor.blockIndex];
    if (rootBlock === undefined) {
      return state;
    }
    if (rootBlock.type === "ordered-list" || rootBlock.type === "unordered-list") {
      return toggleExistingList({
        blockIndex: state.selection.anchor.blockIndex,
        listBlock: rootBlock,
        listType: command.listType,
        state,
      });
    }
    return wrapBlockInList({
      blockIndex: state.selection.anchor.blockIndex,
      listType: command.listType,
      rootBlock,
      state,
    });
  },
  outdentListItem = <Input extends { selected: SelectedTextContext; state: State }>(
    input: Readonly<Input>,
  ): State => {
    if (
      input.selected.rootBlock.type !== "ordered-list" &&
      input.selected.rootBlock.type !== "unordered-list"
    ) {
      return input.state;
    }
    const { selected, state } = input,
      listBlock = selected.rootBlock,
      listItemIndex = state.selection.anchor.listItemIndex ?? emptyIndex,
      listReplacement = conditionalValue(
        listBlock.children.filter((_listItem, index) => index !== listItemIndex).length ===
          emptyIndex,
        [] as readonly RichText.BlockNode[],
        [
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- [EH-143] list replacement preserves list node shape after item removal.
          {
            ...listBlock,
            children:
              // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- [EH-142] list item filtering preserves list-item node shapes within the editor document.
              listBlock.children.filter(
                (_listItem, index) => index !== listItemIndex,
              ) as RichText.ListItemNode[],
          } as RichText.ListNode,
        ],
      ),
      nextBlockIndex =
        state.selection.anchor.blockIndex +
        conditionalValue(listReplacement.length === emptyIndex, emptyIndex, firstIndex),
      paragraph: RichText.ParagraphNode = {
        children: selected.block.children,
        type: "paragraph",
      },
      position = { blockIndex: nextBlockIndex, inlineIndex: emptyIndex, offset: emptyIndex },
      replacement = [
        ...state.document.children.slice(emptyIndex, state.selection.anchor.blockIndex),
        ...listReplacement,
        paragraph,
        ...state.document.children.slice(state.selection.anchor.blockIndex + firstIndex),
      ];
    return commit(
      state,
      { ...state.document, children: replacement },
      { anchor: position, focus: position },
    );
  },
  toggleExistingList = <
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-139] React panel helpers preserve local prop aliases for component call sites.
    Input extends {
      blockIndex: number;
      listBlock: RichText.ListNode;
      listType: "ordered-list" | "unordered-list";
      state: State;
    },
  >(
    input: Readonly<Input>,
  ): State => {
    const { blockIndex, listBlock, listType, state } = input;
    if (listBlock.type !== listType) {
      return commit(
        state,
        replaceBlock(state.document, blockIndex, { ...listBlock, type: listType }),
      );
    }
    return unwrapListItem({ blockIndex, listBlock, state });
  },
  unwrapListItem = <
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-139] React panel helpers preserve local prop aliases for component call sites.
    Input extends {
      blockIndex: number;
      listBlock: RichText.ListNode;
      state: State;
    },
  >(
    input: Readonly<Input>,
  ): State => {
    const { blockIndex, listBlock, state } = input,
      listItemIndex = state.selection.anchor.listItemIndex ?? emptyIndex,
      paragraph = listBlock.children[listItemIndex]?.children[emptyIndex];
    if (paragraph?.type !== "paragraph") {
      return state;
    }
    return unwrapListItemParagraph({
      blockIndex,
      listBlock,
      listItemIndex,
      paragraph,
      state,
    });
  },
  unwrapListItemParagraph = <
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-139] React panel helpers preserve local prop aliases for component call sites.
    Input extends {
      blockIndex: number;
      listBlock: RichText.ListNode;
      listItemIndex: number;
      paragraph: RichText.ParagraphNode;
      state: State;
    },
  >(
    input: Readonly<Input>,
  ): State => {
    const { blockIndex, listBlock, listItemIndex, paragraph, state } = input,
      listReplacement = conditionalValue(
        listBlock.children.filter((_listItem, index) => index !== listItemIndex).length ===
          emptyIndex,
        [] as readonly RichText.BlockNode[],
        [
          {
            ...listBlock,
            children: listBlock.children.filter(
              (_listItem, index) => index !== listItemIndex,
            ),
          } as RichText.ListNode,
        ],
      ),
      nextBlockIndex =
        blockIndex +
        conditionalValue(listReplacement.length === emptyIndex, emptyIndex, firstIndex),
      position = {
        blockIndex: nextBlockIndex,
        inlineIndex: state.selection.anchor.inlineIndex,
        offset: state.selection.anchor.offset,
      };
    return commit(
      state,
      {
        ...state.document,
        children: [
          ...state.document.children.slice(emptyIndex, blockIndex),
          ...listReplacement,
          paragraph,
          ...state.document.children.slice(blockIndex + firstIndex),
        ],
      },
      { anchor: position, focus: position },
    );
  },
  workDeleteBackwardAtListStart = (
    state: State,
    selected: SelectedTextContext,
  ): State => outdentListItem({ selected, state }),
  workDeleteBackwardForSelection = (
    state: State,
    selected: NonNullable<ReturnType<typeof selectedText>>,
  ): State => {
    const { insertText } = transactionsMutations,
      selection = {
        anchor: {
          ...state.selection.anchor,
          offset: conditionalValue(
            selected.start === selected.end,
            Math.max(emptyIndex, selected.start - firstIndex),
            selected.start,
          ),
        },
        focus: { ...state.selection.focus, offset: selected.end },
      };
    return insertText({ ...state, selection }, "");
  },
  wrapBlockInList = <
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-139] React panel helpers preserve local prop aliases for component call sites.
    Input extends {
      blockIndex: number;
      listType: "ordered-list" | "unordered-list";
      rootBlock: RichText.BlockNode;
      state: State;
    },
  >(
    input: Readonly<Input>,
  ): State => {
    if (input.rootBlock.type !== "paragraph" && input.rootBlock.type !== "heading") {
      return input.state;
    }
    const { blockIndex, listType, rootBlock, state } = input,
      anchor = { ...state.selection.anchor, listItemIndex: emptyIndex },
      focus = { ...state.selection.focus, listItemIndex: emptyIndex },
      list: RichText.ListNode = {
        children: [
          {
            children: [
              {
                children:
                  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- [EH-146] paragraph children inherit inline nodes from the lifted block root.
                  rootBlock.children as RichText.InlineNode[],
                type: "paragraph",
              },
            ],
            type: "list-item",
          },
        ],
        type: listType,
      };
    return commit(state, replaceBlock(state.document, blockIndex, list), { anchor, focus });
  };

export default { applyDeleteBackward, applyToggleList };
