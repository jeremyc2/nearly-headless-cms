import transactionsEditorAdapterRender from "./transactions-editor-adapter-render.ts";
import transactionsEditorAdapterSelection from "./transactions-editor-adapter-selection.ts";
import transactionsEditorAdapterSupport from "./transactions-editor-adapter-support.ts";

const { renderBlockElement } = transactionsEditorAdapterRender,
  { restoreSelectionRange, synchronizeSelectionState } = transactionsEditorAdapterSelection;

export default {
  ...transactionsEditorAdapterSupport,
  renderBlockElement,
  restoreSelectionRange,
  synchronizeSelectionState,
};

