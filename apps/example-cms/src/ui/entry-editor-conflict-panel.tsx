import type { EntryConflict } from "./entry-editor-types.ts";
import { queryClient } from "./main-shared.ts";

const EntryEditorConflictActions = <
    Conflict extends EntryConflict,
    LatestValues extends Record<string, unknown>,
    OnDiscard extends (latestValues: Readonly<LatestValues>) => void,
    OnReapply extends () => void,
  >({
    conflict,
    contentTypeId,
    entryId,
    isSaving,
    onDiscard,
    onReapply,
  }: {
    readonly conflict: Readonly<Conflict>;
    readonly contentTypeId: string;
    readonly entryId: string;
    readonly isSaving: boolean;
    readonly onDiscard: Readonly<OnDiscard>;
    readonly onReapply: Readonly<OnReapply>;
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
  EntryEditorConflictComparison = <
    Conflict extends EntryConflict,
    Values extends Record<string, unknown>,
  >({
    conflict,
    values,
  }: {
    readonly conflict: Readonly<Conflict>;
    readonly values: Readonly<Values>;
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
  EntryEditorConflictPanel = <
    Conflict extends EntryConflict,
    Values extends Record<string, unknown>,
    LatestValues extends Record<string, unknown>,
    OnDiscard extends (latestValues: Readonly<LatestValues>) => void,
    OnReapply extends () => void,
  >({
    conflict,
    contentTypeId,
    entryId,
    isSaving,
    onDiscard,
    onReapply,
    values,
  }: {
    readonly conflict: Readonly<Conflict>;
    readonly contentTypeId: string;
    readonly entryId: string;
    readonly isSaving: boolean;
    readonly onDiscard: Readonly<OnDiscard>;
    readonly onReapply: Readonly<OnReapply>;
    readonly values: Readonly<Values>;
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
