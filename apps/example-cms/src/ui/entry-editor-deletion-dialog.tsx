import { EntryEditorDeletionDialogPanel } from "./entry-editor-deletion-dialog-panel.tsx";
import type { DeletionRecord } from "./entry-editor-types.ts";

interface EntryEditorDeletionDialogProperties {
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

export const EntryEditorDeletionDialog = (properties: EntryEditorDeletionDialogProperties) => (
  <div className="rich-dialog-backdrop">
    <div
      aria-labelledby="entry-deletion-title"
      aria-modal="true"
      className="rich-dialog destructive-dialog"
      role="dialog"
    >
      <EntryEditorDeletionDialogPanel {...properties} />
    </div>
  </div>
);
