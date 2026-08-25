import {
  type DeletionRecord,
  type EntryConflict,
  useEntryEditorDeleteMutation,
  useEntryEditorEditorialMutation,
  useEntryEditorPurgeMutation,
  useEntryEditorSaveMutation,
} from "./entry-editor-controller-mutations-imports.ts";

export const useEntryEditorControllerMutations = <
  Values extends Record<string, unknown>,
  OnSaved extends (values: Values) => void,
  OnUpdated extends (values: Values) => void,
>({
  contentTypeId,
  deletionRecord,
  entryId,
  onConflict,
  onDeleted,
  onSaved,
  onUpdated,
  writeToken,
}: {
  readonly contentTypeId: string;
  readonly deletionRecord?: DeletionRecord;
  readonly entryId: string;
  readonly onConflict: (latest: EntryConflict["latest"]) => void;
  readonly onDeleted: (receipt: DeletionRecord) => void;
  readonly onSaved: Readonly<OnSaved>;
  readonly onUpdated: Readonly<OnUpdated>;
  readonly writeToken?: string;
}) => {
  const deleteEntry = useEntryEditorDeleteMutation({
      contentTypeId,
      entryId,
      onDeleted,
      writeToken,
    }),
    editorialCommand = useEntryEditorEditorialMutation({
      contentTypeId,
      entryId,
      onUpdated,
      writeToken,
    }),
    permanentlyPurge = useEntryEditorPurgeMutation({ contentTypeId, deletionRecord }),
    save = useEntryEditorSaveMutation({
      contentTypeId,
      entryId,
      onConflict,
      onSaved,
    });
  return { deleteEntry, editorialCommand, permanentlyPurge, save };
};

export default {
  useEntryEditorControllerMutations,
};
