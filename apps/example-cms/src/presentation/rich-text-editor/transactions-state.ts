import { type Selection, type State } from "./transactions-types.ts";
import {
  emptyDocument,
  emptyIndex,
  firstIndex,
  historyLimit,
  signature,
} from "./transactions-constants.ts";
import type { RichText } from "nearly-headless-cms";
import { normalize } from "./transactions-normalize.ts";
import transactionsSelection from "./transactions-selection.ts";
import transactionsSelectionOffset from "./transactions-selection-offset.ts";
import transactionsSupport from "./transactions-support.ts";

const { reconcileSelection } = transactionsSelectionOffset,
  { conditionalValue } = transactionsSupport,
  commit = (
    state: State,
    document: RichText.Document,
    selection: Selection = state.selection,
  ): State => {
    const normalized = normalize(document),
      reconciledSelection = reconcileSelection({
        normalizedDocument: normalized,
        resolveInlineBlock: (rootBlock, listItemIndex) =>
          transactionsSelection.resolveSelectedBlock(rootBlock, listItemIndex)?.block,
        selection,
        sourceDocument: document,
      });
    if (signature(normalized) === signature(state.document)) {
      return { ...state, selection: reconciledSelection };
    }
    return workCommitChangedDocument(state, normalized, reconciledSelection);
  },
  create = (document: RichText.Document = emptyDocument()): State => {
    const normalized = normalize(document);
    return {
      cleanSignature: signature(normalized),
      composing: false,
      document: normalized,
      history: [normalized],
      historyIndex: emptyIndex,
      selection: {
        anchor: { blockIndex: emptyIndex, inlineIndex: emptyIndex, offset: emptyIndex },
        focus: { blockIndex: emptyIndex, inlineIndex: emptyIndex, offset: emptyIndex },
      },
      storedMarks: null,
    };
  },
  isDirty = (state: State): boolean => signature(state.document) !== state.cleanSignature,
  load = (document: RichText.Document): State => create(document),
  markClean = (state: State): State => ({
    ...state,
    cleanSignature: signature(state.document),
  }),
  persistedDocument = (state: State): RichText.Document => structuredClone(state.document),
  replaceBlock = (
    document: RichText.Document,
    blockIndex: number,
    block: RichText.BlockNode,
  ): RichText.Document => ({
    ...document,
    children: document.children.map((candidate, index) =>
      conditionalValue(index === blockIndex, block, candidate),
    ),
  }),
  workCommitChangedDocument = (
    state: State,
    normalized: RichText.Document,
    selection: Selection,
  ): State => {
    const nextHistory = [
      ...state.history.slice(emptyIndex, state.historyIndex + firstIndex),
      normalized,
    ].slice(-historyLimit);
    return {
      ...state,
      document: normalized,
      history: nextHistory,
      historyIndex: nextHistory.length - firstIndex,
      selection,
    };
  };

export { create, isDirty, load, markClean, persistedDocument };
export default { commit, replaceBlock };
