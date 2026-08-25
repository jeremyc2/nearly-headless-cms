import { deletionConsequence } from "./main-entry-support.ts";

export const EntryEditorDangerPanel = ({
  contentTypeId,
  deleteErrorMessage,
  isDeleting,
  onRequestDeletion,
  saveDisabled,
}: {
  readonly contentTypeId: string;
  readonly deleteErrorMessage?: string;
  readonly isDeleting: boolean;
  readonly onRequestDeletion: () => void;
  readonly saveDisabled: boolean;
}) => (
  <section className="danger-panel panel">
    <p className="eyebrow">Danger zone</p>
    <h2>Delete this Entry</h2>
    <p>{deletionConsequence(contentTypeId)}</p>
    <button
      className="danger-button"
      disabled={isDeleting || saveDisabled}
      onClick={onRequestDeletion}
      type="button"
    >
      Delete Entry…
    </button>
    {deleteErrorMessage !== undefined && (
      <p className="error-state" role="alert">
        {deleteErrorMessage}
      </p>
    )}
  </section>
);

