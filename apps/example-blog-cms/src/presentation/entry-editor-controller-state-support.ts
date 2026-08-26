import entryEditorControllerLocalStateSupport from "./entry-editor-controller-local-state-support.ts";
import { useEffect } from "react";

const {
    useEntryEditorControllerFieldBindings,
    useEntryEditorControllerLocalState,
    useEntryEditorControllerMutationBindings,
  } = entryEditorControllerLocalStateSupport,
  useEntryEditorControllerState = () => {
    const localState = useEntryEditorControllerLocalState(),
      { mutations, saveValues } = useEntryEditorControllerMutationBindings(localState),
      { title, titleField, updateField } = useEntryEditorControllerFieldBindings(localState);
    useEffect(() => {
      if (
        localState.state.data !== undefined &&
        localState.loadedEntryIdentifier.current !== localState.entryId
      ) {
        localState.loadedEntryIdentifier.current = localState.entryId;
        localState.setValues(structuredClone(localState.state.data.entry.values));
        localState.setConflict(undefined);
      }
    }, [localState.entryId, localState.state.data]);
    return {
      ...localState,
      mutations,
      saveValues,
      title,
      titleField,
      updateField,
    };
  };

export default {
  useEntryEditorControllerState,
};
