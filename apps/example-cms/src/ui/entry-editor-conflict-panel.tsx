import type { EntryConflict } from "./entry-editor-types.ts";
import { queryClient } from "./main-shared.ts";

export const EntryEditorConflictPanel = ({
  conflict,
  contentTypeId,
  entryId,
  isSaving,
  onDiscard,
  onReapply,
  values,
}: {
  readonly conflict: EntryConflict;
  readonly contentTypeId: string;
  readonly entryId: string;
  readonly isSaving: boolean;
  readonly onDiscard: (latestValues: Record<string, unknown>) => void;
  readonly onReapply: () => void;
  readonly values: Record<string, unknown>;
}) => (
  <section aria-labelledby="conflict-title" className="conflict-panel" role="alert">
    <div>
      <p className="eyebrow">Conflict</p>
      <h2 id="conflict-title">A newer CMS revision exists</h2>
      <p>
        Your complete local draft is preserved. Compare it with revision{" "}
        {conflict.latest.revisionNumber}, then deliberately reapply or discard it.
      </p>
    </div>
    <EntryEditorConflictComparison conflict={conflict} values={values} />
    <EntryEditorConflictActions
      conflict={conflict}
      contentTypeId={contentTypeId}
      entryId={entryId}
      isSaving={isSaving}
      onDiscard={onDiscard}
      onReapply={onReapply}
    />
  </section>
),

EntryEditorConflictComparison = ({
  conflict,
  values,
}: {
  readonly conflict: EntryConflict;
  readonly values: Record<string, unknown>;
}) => (
  <div className="conflict-comparison">
    <details>
      <summary>Your local draft</summary>
      <pre>{JSON.stringify(values, null, 2)}</pre>
    </details>
    <details>
      <summary>Latest CMS revision</summary>
      <pre>{JSON.stringify(conflict.latest.entry.values, null, 2)}</pre>
    </details>
  </div>
),

EntryEditorConflictActions = ({
  conflict,
  contentTypeId,
  entryId,
  isSaving,
  onDiscard,
  onReapply,
}: {
  readonly conflict: EntryConflict;
  readonly contentTypeId: string;
  readonly entryId: string;
  readonly isSaving: boolean;
  readonly onDiscard: (latestValues: Record<string, unknown>) => void;
  readonly onReapply: () => void;
}) => (
  <div className="editor-actions">
    <button className="primary-button" disabled={isSaving} onClick={onReapply} type="button">
      Reapply my draft
    </button>
    <button
      className="secondary-button"
      onClick={() => {
        onDiscard(conflict.latest.entry.values);
        queryClient.setQueryData(["entry-state", contentTypeId, entryId], conflict.latest);
      }}
      type="button"
    >
      Discard my draft
    </button>
  </div>
);
