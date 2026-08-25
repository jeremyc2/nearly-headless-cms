import type { EntryEditorControllerViewInput } from "./entry-editor-controller-view-types.ts";

const entryEditorControllerConflictActions = <
  Input extends EntryEditorControllerViewInput,
  LatestValues extends Record<string, unknown>,
>({
  conflict,
  saveValues,
  setConflict,
  setValues,
  values,
}: Readonly<Input>) => ({
  discardConflict: (latestValues: Readonly<LatestValues>) => {
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
