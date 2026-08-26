import { useNavigate } from "@tanstack/react-router";
import entryEditorControllerViewSupport from "./entry-editor-controller-view.ts";
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
