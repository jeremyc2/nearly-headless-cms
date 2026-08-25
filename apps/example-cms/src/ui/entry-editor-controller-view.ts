import entryEditorControllerViewSupport, {
  type EntryEditorControllerViewInput,
} from "./entry-editor-controller-view-support.ts";

const { entryEditorControllerViewModel } = entryEditorControllerViewSupport,
  useEntryEditorControllerView = <Input extends EntryEditorControllerViewInput>(
    input: Readonly<Input>,
  ) => entryEditorControllerViewModel(input);

export default {
  useEntryEditorControllerView,
};
