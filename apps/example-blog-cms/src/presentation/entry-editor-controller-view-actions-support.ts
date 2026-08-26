import type { EntryEditorControllerViewInput } from "./entry-editor-controller-view-types.ts";

const entryEditorControllerConflictActions = <
  // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-201] React panel helpers preserve local prop aliases for component call sites.
  Input extends EntryEditorControllerViewInput,
  // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-201] React panel helpers preserve local prop aliases for component call sites.
  LatestValues extends Record<string, unknown>,
>({
  conflict,
  saveValues,
  setConflict,
  setValues,
  values,
}: Readonly<Input>) =>
  ({
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
