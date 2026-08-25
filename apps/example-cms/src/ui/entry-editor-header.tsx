import { Link } from "@tanstack/react-router";
import { saveStatus } from "./main-labels.ts";

export const EntryEditorHeader = ({
  contentTypeId,
  isSaving,
  onSave,
  revisionNumber,
  saveDisabled,
  title,
}: {
  readonly contentTypeId: string;
  readonly isSaving: boolean;
  readonly onSave: () => void;
  readonly revisionNumber?: number;
  readonly saveDisabled: boolean;
  readonly title: string;
}) => (
  <header className="editor-header">
    <div>
      <Link className="back-link" params={{ contentTypeId }} to="/content/$contentTypeId">
        ← {contentTypeId}
      </Link>
      <h1>{title || "Entry"}</h1>
      <p>
        <span className="saved-dot" /> {saveStatus(isSaving)} · Revision {revisionNumber ?? "—"}
      </p>
    </div>
    <div className="editor-actions">
      <button className="secondary-button" type="button">
        Preview readiness
      </button>
      <button className="primary-button" disabled={saveDisabled} onClick={onSave} type="button">
        Save changes
      </button>
    </div>
  </header>
);

