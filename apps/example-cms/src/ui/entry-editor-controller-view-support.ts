import type { EditorialConfirmationStatus } from "./entry-editor-controller-view-imports.ts";
import type { EntryEditorControllerViewInput } from "./entry-editor-controller-view-types.ts";
import entryEditorControllerViewActionsSupport from "./entry-editor-controller-view-actions-support.ts";

const { entryEditorControllerConflictActions } = entryEditorControllerViewActionsSupport,
  entryEditorControllerActions = (input: EntryEditorControllerViewInput) => ({
    ...entryEditorControllerConflictActions(input),
    cancelDeletion: () => {
      input.setDeletionDialogOpen(false);
    },
    cancelEditorialConfirmation: () => {
      input.setEditorialConfirmation(undefined);
    },
    cancelPurge: () => {
      input.setConfirmPurge(false);
    },
    confirmEditorialChange: (status: EditorialConfirmationStatus) => {
      input.mutations.editorialCommand.mutate(status);
      input.setEditorialConfirmation(undefined);
    },
    confirmPurgeAction: () => {
      input.mutations.permanentlyPurge.mutate();
    },
    requestDeletion: () => {
      input.setDeletionDialogOpen(true);
    },
    requestEditorialConfirmation: input.setEditorialConfirmation,
    returnToList: () => {
      void input.navigate({ params: { contentTypeId: input.contentTypeId }, to: "/content/$contentTypeId" });
    },
    startPurge: () => {
      input.setConfirmPurge(true);
    },
    submitDeletion: () => {
      input.mutations.deleteEntry.mutate();
    },
  }),
  entryEditorControllerViewModel = (input: EntryEditorControllerViewInput) => ({
    ...entryEditorControllerActions(input),
    assets: input.assets,
    authors: input.authors,
    categories: input.categories,
    confirmPurge: input.confirmPurge,
    conflict: input.conflict,
    contentTypeId: input.contentTypeId,
    deleteEntry: input.mutations.deleteEntry,
    deletionDialogOpen: input.deletionDialogOpen,
    deletionRecord: input.deletionRecord,
    editorialCommand: input.mutations.editorialCommand,
    editorialConfirmation: input.editorialConfirmation,
    entryId: input.entryId,
    permanentlyPurge: input.mutations.permanentlyPurge,
    save: input.mutations.save,
    saveValues: input.saveValues,
    state: input.state,
    tags: input.tags,
    title: input.title,
    titleField: input.titleField,
    updateField: input.updateField,
    values: input.values,
  });

export type { EntryEditorControllerViewInput } from "./entry-editor-controller-view-types.ts";

export default {
  entryEditorControllerViewModel,
};
