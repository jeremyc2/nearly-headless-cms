import {
  entryEditorControllerViewSupport,
  useNavigate,
} from "./entry-editor-controller-imports.ts";
import entryEditorControllerStateSupport from "./entry-editor-controller-state-support.ts";

const { useEntryEditorControllerView } = entryEditorControllerViewSupport,
  { useEntryEditorControllerState } = entryEditorControllerStateSupport,
  useEntryEditorController = () => {
    const controllerState = useEntryEditorControllerState(),
      navigate = useNavigate();
    return useEntryEditorControllerView({
      navigate,
      ...controllerState,
    });
  };

export default {
  useEntryEditorController,
};
