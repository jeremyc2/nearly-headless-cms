import entryEditorControllerViewSupport, {
  type EntryEditorControllerViewInput,
} from "./entry-editor-controller-view-support.ts";

const { entryEditorControllerViewModel } = entryEditorControllerViewSupport,
  useEntryEditorControllerView = (input: EntryEditorControllerViewInput) =>
    entryEditorControllerViewModel(input);

export default {
  useEntryEditorControllerView,
};
