import type { EntryEditorControllerViewInput } from "./entry-editor-controller-view-types.ts";

const entryEditorControllerConflictActions = ({
    conflict,
    saveValues,
    setConflict,
    setValues,
    values,
  }: EntryEditorControllerViewInput) => ({
    discardConflict: (latestValues: Record<string, unknown>) => {
      setValues(structuredClone(latestValues));
      setConflict(undefined);
    },
    reapplyConflict: () => {
      if (conflict !== undefined) {
        saveValues(values, conflict.latest.writeToken);
      }
    },
  });

export default {
  entryEditorControllerConflictActions,
};
