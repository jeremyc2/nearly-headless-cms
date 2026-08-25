import type { EntryConflict } from "./entry-editor-types.ts";
import { queryClient } from "./main-shared.ts";

const EntryEditorConflictActions = ({
    conflict,
    contentTypeId,
    entryId,
    isSaving,
    onDiscard,
    onReapply,
  }: {
    readonly conflict: Readonly<EntryConflict>;
    readonly contentTypeId: string;
    readonly entryId: string;
    readonly isSaving: boolean;
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-161] conflict resolution callbacks receive mutable draft value maps.
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
  ),
  EntryEditorConflictComparison = ({
    conflict,
    values,
  }: {
    readonly conflict: Readonly<EntryConflict>;
    readonly values: Readonly<Record<string, unknown>>;
  }) => (
    <div className="conflict-comparison">
      <details>
        <summary>Your local draft</summary>
        <pre>{JSON.stringify(values, null, jsonPreviewIndent)}</pre>
      </details>
      <details>
        <summary>Latest CMS revision</summary>
        <pre>{JSON.stringify(conflict.latest.entry.values, null, jsonPreviewIndent)}</pre>
      </details>
    </div>
  ),
  EntryEditorConflictPanel = ({
    conflict,
    contentTypeId,
    entryId,
    isSaving,
    onDiscard,
    onReapply,
    values,
  }: {
    readonly conflict: Readonly<EntryConflict>;
    readonly contentTypeId: string;
    readonly entryId: string;
    readonly isSaving: boolean;
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-161] conflict resolution callbacks receive mutable draft value maps.
    readonly onDiscard: (latestValues: Record<string, unknown>) => void;
    readonly onReapply: () => void;
    readonly values: Readonly<Record<string, unknown>>;
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
  jsonPreviewIndent = 2;

export { EntryEditorConflictPanel };
