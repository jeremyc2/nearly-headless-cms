import {
  useEntryEditorDeleteMutation,
  useEntryEditorEditorialMutation,
  useEntryEditorPurgeMutation,
  useEntryEditorSaveMutation,
} from "./entry-editor-mutations.ts";
import type { DeletionRecord, EntryConflict } from "./entry-editor-types.ts";

export const useEntryEditorControllerMutations = ({
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
  readonly onSaved: (values: Record<string, unknown>) => void;
  readonly onUpdated: (values: Record<string, unknown>) => void;
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
