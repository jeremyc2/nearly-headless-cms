import { type Command, type State, secondHeadingLevel } from "./transactions-types.ts";
import { emptyIndex, firstIndex } from "./transactions-constants.ts";
import type { RichText } from "nearly-headless-cms";
import { selectedText } from "./transactions-selection.ts";
import transactionsMutations from "./transactions-mutations.ts";
import transactionsState from "./transactions-state.ts";
import transactionsSupport from "./transactions-support.ts";

const { commit, replaceBlock } = transactionsState,
  { conditionalValue } = transactionsSupport,
  applyComposition = (state: State, command: Extract<Command, { type: "composition" }>): State => ({
    ...state,
    composing: command.active,
  }),
  applyInsertAssetReference = (
    state: State,
    command: Extract<Command, { type: "insertAssetReference" }>,
  ): State => {
    const asset: RichText.AssetReferenceNode = {
        alternativeText: command.alternativeText,
        assetId: command.assetId,
        children: [],
        type: "asset-reference",
        ...conditionalValue(command.caption === undefined, {}, { caption: command.caption }),
      },
      children = [
        ...state.document.children.slice(emptyIndex, state.selection.focus.blockIndex + firstIndex),
        asset,
        ...state.document.children.slice(state.selection.focus.blockIndex + firstIndex),
      ],
      position = {
        blockIndex: state.selection.focus.blockIndex + firstIndex,
        inlineIndex: emptyIndex,
        offset: emptyIndex,
      };
    return commit(state, { ...state.document, children }, { anchor: position, focus: position });
  },
  applyInsertEntryReference = (
    state: State,
    command: Extract<Command, { type: "insertEntryReference" }>,
  ): State => {
    const selected = selectedText(state);
    if (selected === undefined) {
      return state;
    }
    return workInsertEntryReferenceForSelection(state, selected, command);
  },
  applyInsertText = (state: State, command: Extract<Command, { type: "insertText" }>): State =>
    transactionsMutations.insertText(state, command.text),
  applyRedo = (state: State): State => {
    const document =
        state.history[Math.min(state.history.length - firstIndex, state.historyIndex + firstIndex)],
      historyIndex = Math.min(state.history.length - firstIndex, state.historyIndex + firstIndex);
    if (document === undefined) {
      throw new Error("Redo history entry is missing");
    }
    return { ...state, document: structuredClone(document), historyIndex };
  },
  applySelect = (state: State, command: Extract<Command, { type: "select" }>): State => ({
    ...state,
    selection: { anchor: command.anchor, focus: command.focus },
    storedMarks: null,
  }),
  applySetBlockKind = (
    state: State,
    command: Extract<Command, { type: "setBlockKind" }>,
  ): State => {
    const block = state.document.children[state.selection.anchor.blockIndex];
    if (block?.type !== "paragraph" && block?.type !== "heading") {
      return state;
    }
    return commit(
      state,
      replaceBlock(
        state.document,
        state.selection.anchor.blockIndex,
        buildBlockReplacement(block, command),
      ),
    );
  },
  applySplitBlock = (state: State): State => transactionsMutations.splitBlock(state),
  applyToggleMark = (state: State, command: Extract<Command, { type: "toggleMark" }>): State =>
    transactionsMutations.toggleMark(state, command.mark),
  applyUndo = (state: State): State => {
    const document = state.history[Math.max(emptyIndex, state.historyIndex - firstIndex)],
      historyIndex = Math.max(emptyIndex, state.historyIndex - firstIndex);
    if (document === undefined) {
      throw new Error("Undo history entry is missing");
    }
    return { ...state, document: structuredClone(document), historyIndex };
  },
  applyWrapLink = (state: State, command: Extract<Command, { type: "wrapLink" }>): State => {
    const selected = selectedText(state);
    if (selected === undefined) {
      return state;
    }
    return workWrapLinkForSelection(state, selected, command);
  },
  buildBlockReplacement = (
    block: RichText.ParagraphNode | RichText.HeadingNode,
    command: Extract<Command, { type: "setBlockKind" }>,
  ): RichText.BlockNode => {
    if (command.blockType === "heading") {
      return {
        children: block.children,
        level: command.headingLevel ?? secondHeadingLevel,
        type: "heading",
      };
    }
    if (command.blockType === "paragraph") {
      return { children: block.children, type: "paragraph" };
    }
    if (command.blockType === "code-block") {
      return {
        children: [
          {
            text: block.children
              .map((node) => {
                if ("text" in node) {
                  return node.text;
                }
                return "";
              })
              .join(""),
            type: "text",
          },
        ],
        type: "code-block",
      };
    }
    return {
      children: [{ children: block.children, type: "paragraph" }],
      type: "quote",
    };
  },
  workInsertEntryReferenceForSelection = (
    state: State,
    selected: NonNullable<ReturnType<typeof selectedText>>,
    command: Extract<Command, { type: "insertEntryReference" }>,
  ): State => {
    const { insertReference } = transactionsMutations,
      label = workResolveReferenceLabel(selected, command.label);
    if (label.length === emptyIndex) {
      return state;
    }
    return insertReference(state, {
      children: [{ text: label, type: "text" }],
      entryId: command.entryId,
      type: "entry-reference",
    });
  },
  workResolveReferenceLabel = (
    selected: NonNullable<ReturnType<typeof selectedText>>,
    commandLabel: string | undefined,
  ): string => {
    if (selected.start !== selected.end) {
      return selected.text.text.slice(selected.start, selected.end);
    }
    return commandLabel ?? "";
  },
  workWrapLinkForSelection = (
    state: State,
    selected: NonNullable<ReturnType<typeof selectedText>>,
    command: Extract<Command, { type: "wrapLink" }>,
  ): State => {
    const { insertReference } = transactionsMutations,
      label = workResolveReferenceLabel(selected, command.label);
    if (label.length === emptyIndex) {
      return state;
    }
    return insertReference(state, {
      children: [
        {
          text: label,
          type: "text",
          ...conditionalValue(
            selected.text.marks === undefined,
            {},
            { marks: selected.text.marks },
          ),
        },
      ],
      type: "link",
      url: command.url,
    });
  };

export default {
  applyComposition,
  applyInsertAssetReference,
  applyInsertEntryReference,
  applyInsertText,
  applyRedo,
  applySelect,
  applySetBlockKind,
  applySplitBlock,
  applyToggleMark,
  applyUndo,
  applyWrapLink,
};
