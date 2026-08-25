import { EntryEditorDeletionDialog } from "./entry-editor-deletion-dialog.tsx";
import { EntryEditorEditorialDialog } from "./entry-editor-editorial-dialog.tsx";
import type { useEntryEditorController } from "./entry-editor-controller.ts";

export const EntryEditorOverlays = <
  Controller extends ReturnType<typeof useEntryEditorController>,
>({
  controller,
}: {
  readonly controller: Readonly<Controller>;
}) => (
  <>
    {controller.editorialConfirmation !== undefined && (
      <EntryEditorEditorialDialog
        confirmation={controller.editorialConfirmation}
        isPending={controller.editorialCommand.isPending}
        onCancel={controller.cancelEditorialConfirmation}
        onConfirm={controller.confirmEditorialChange}
      />
    )}
    {(controller.deletionDialogOpen || controller.deletionRecord !== undefined) && (
      <EntryEditorDeletionDialog
        confirmPurge={controller.confirmPurge}
        contentTypeId={controller.contentTypeId}
        deletionRecord={controller.deletionRecord}
        isDeleting={controller.deleteEntry.isPending}
        isPurging={controller.permanentlyPurge.isPending}
        onCancelDeletion={controller.cancelDeletion}
        onCancelPurge={controller.cancelPurge}
        onConfirmDeletion={controller.submitDeletion}
        onConfirmPurge={controller.confirmPurgeAction}
        onReturnToList={controller.returnToList}
        onStartPurge={controller.startPurge}
        purgeErrorMessage={controller.permanentlyPurge.error?.message}
        title={controller.title}
      />
    )}
  </>
);
