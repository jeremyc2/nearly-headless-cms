import { type Command, type State } from "./transactions-types.ts";
import { emptyIndex, firstIndex } from "./transactions-constants.ts";
import type { RichText } from "nearly-headless-cms";
import transactionsSelection from "./transactions-selection.ts";
import transactionsMutations from "./transactions-mutations.ts";
import transactionsState from "./transactions-state.ts";
import transactionsSupport from "./transactions-support.ts";
import transactionsBlockKindHandlers from "./transactions-block-kind-handlers.ts";

const { commit } = transactionsState,
  { selectedText } = transactionsSelection,
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
  applySelect = (state: State, command: Extract<Command, { type: "select" }>): State => {
    const selectionChanged =
      JSON.stringify(state.selection.anchor) !== JSON.stringify(command.anchor) ||
      JSON.stringify(state.selection.focus) !== JSON.stringify(command.focus);
    return {
      ...state,
      selection: { anchor: command.anchor, focus: command.focus },
      storedMarks: selectionChanged ? null : state.storedMarks,
    };
  },
  applySetBlockKind = (
    state: State,
    command: Extract<Command, { type: "setBlockKind" }>,
  ): State => transactionsBlockKindHandlers.applySetBlockKind(state, command),
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
