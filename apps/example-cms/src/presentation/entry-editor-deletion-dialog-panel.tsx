import {
  EntryEditorDeletionComplete,
  EntryEditorDeletionConfirm,
  EntryEditorPurgeConfirm,
} from "./entry-editor-deletion-dialog-support.tsx";
import type { DeletionRecord } from "./entry-editor-types.ts";

interface EntryEditorDeletionDialogPanelProperties {
  readonly confirmPurge: boolean;
  readonly contentTypeId: string;
  readonly deletionRecord?: DeletionRecord;
  readonly isDeleting: boolean;
  readonly isPurging: boolean;
  readonly onCancelDeletion: () => void;
  readonly onCancelPurge: () => void;
  readonly onConfirmDeletion: () => void;
  readonly onConfirmPurge: () => void;
  readonly onReturnToList: () => void;
  readonly onStartPurge: () => void;
  readonly purgeErrorMessage?: string;
  readonly title: string;
}

export const EntryEditorDeletionDialogPanel = ({
  confirmPurge,
  contentTypeId,
  deletionRecord,
  isDeleting,
  isPurging,
  onCancelDeletion,
  onCancelPurge,
  onConfirmDeletion,
  onConfirmPurge,
  onReturnToList,
  onStartPurge,
  purgeErrorMessage,
  title,
}: EntryEditorDeletionDialogPanelProperties) => (
  <>
    {deletionRecord === undefined && (
      <EntryEditorDeletionConfirm
        contentTypeId={contentTypeId}
        isDeleting={isDeleting}
        onCancel={onCancelDeletion}
        onConfirm={onConfirmDeletion}
        title={title}
      />
    )}
    {deletionRecord !== undefined && confirmPurge && (
      <EntryEditorPurgeConfirm
        isPurging={isPurging}
        onCancel={onCancelPurge}
        onConfirm={onConfirmPurge}
        purgeErrorMessage={purgeErrorMessage}
      />
    )}
    {deletionRecord !== undefined && !confirmPurge && (
      <EntryEditorDeletionComplete onReturnToList={onReturnToList} onStartPurge={onStartPurge} />
    )}
  </>
);

export type { EntryEditorDeletionDialogPanelProperties };
