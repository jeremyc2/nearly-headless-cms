import { editorialConfirmationDescription, editorialConfirmationLabel } from "./main-labels.ts";
import { closeWhenBackdropClicked } from "./main-shared.ts";
import type { EditorialConfirmationStatus } from "./entry-editor-types.ts";

export const EntryEditorEditorialDialog = ({
  confirmation,
  isPending,
  onCancel,
  onConfirm,
}: {
  readonly confirmation: EditorialConfirmationStatus;
  readonly isPending: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: (status: EditorialConfirmationStatus) => void;
}) => (
  <div className="rich-dialog-backdrop" onClick={closeWhenBackdropClicked(onCancel)}>
    <div
      aria-labelledby="editorial-command-title"
      aria-modal="true"
      className="rich-dialog"
      role="dialog"
    >
      <p className="eyebrow">Confirm editorial change</p>
      <h2 id="editorial-command-title">{editorialConfirmationLabel(confirmation)}</h2>
      <p>{editorialConfirmationDescription(confirmation)}</p>
      <div className="editor-actions">
        <button className="secondary-button" onClick={onCancel} type="button">
          Cancel
        </button>
        <button
          className="primary-button"
          disabled={isPending}
          onClick={() => {
            onConfirm(confirmation);
          }}
          type="button"
        >
          Confirm change
        </button>
      </div>
    </div>
  </div>
);
