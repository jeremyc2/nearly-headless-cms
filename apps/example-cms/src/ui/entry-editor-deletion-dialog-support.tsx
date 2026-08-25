import { deletionStatus, entryDeletionTitle, purgeStatus } from "./main-labels.ts";
import { deletionConsequence } from "./main-entry-support.ts";

const EntryEditorDeletionComplete = ({
    onReturnToList,
    onStartPurge,
  }: {
    readonly onReturnToList: () => void;
    readonly onStartPurge: () => void;
  }) => (
    <>
      <p className="eyebrow">Entry deleted</p>
      <h2 id="entry-deletion-title">The live Entry is gone</h2>
      <p>Its retained history remains available for restoration through the API.</p>
      <div className="editor-actions">
        <button className="primary-button" onClick={onReturnToList} type="button">
          Return to list
        </button>
        <button className="danger-button" onClick={onStartPurge} type="button">
          Permanently purge…
        </button>
      </div>
    </>
  ),
  EntryEditorDeletionConfirm = ({
    contentTypeId,
    isDeleting,
    onCancel,
    onConfirm,
    title,
  }: {
    readonly contentTypeId: string;
    readonly isDeleting: boolean;
    readonly onCancel: () => void;
    readonly onConfirm: () => void;
    readonly title: string;
  }) => (
    <>
      <p className="eyebrow">Confirm deletion</p>
      <h2 id="entry-deletion-title">Delete “{entryDeletionTitle(title)}”?</h2>
      <p>{deletionConsequence(contentTypeId)}</p>
      <p>The retained revisions can be restored until you permanently purge them.</p>
      <div className="editor-actions">
        <button className="secondary-button" onClick={onCancel} type="button">
          Cancel
        </button>
        <button className="danger-button" disabled={isDeleting} onClick={onConfirm} type="button">
          {deletionStatus(isDeleting)}
        </button>
      </div>
    </>
  ),
  EntryEditorPurgeConfirm = ({
    isPurging,
    onCancel,
    onConfirm,
    purgeErrorMessage,
  }: {
    readonly isPurging: boolean;
    readonly onCancel: () => void;
    readonly onConfirm: () => void;
    readonly purgeErrorMessage?: string;
  }) => (
    <>
      <p className="eyebrow">Irreversible action</p>
      <h2 id="entry-deletion-title">Permanently purge retained history?</h2>
      <p>This cannot be undone. Every retained revision and the restoration path vanish.</p>
      {purgeErrorMessage !== undefined && (
        <p className="error-state" role="alert">
          {purgeErrorMessage}
        </p>
      )}
      <div className="editor-actions">
        <button className="secondary-button" onClick={onCancel} type="button">
          Keep retained history
        </button>
        <button className="danger-button" disabled={isPurging} onClick={onConfirm} type="button">
          {purgeStatus(isPurging)}
        </button>
      </div>
    </>
  );

export { EntryEditorDeletionComplete, EntryEditorDeletionConfirm, EntryEditorPurgeConfirm };

