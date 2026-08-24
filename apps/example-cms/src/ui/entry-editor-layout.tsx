import type { AssetRepresentation, EntryRepresentation } from "../generated/management-client.ts";
import { EntryEditorDangerPanel } from "./entry-editor-danger-panel.tsx";
import { EntryEditorHistoryPanel } from "./entry-editor-history-panel.tsx";
import type {
  useEntryEditorDeleteMutation,
  useEntryEditorEditorialMutation,
} from "./entry-editor-mutations.ts";
import { EntryEditorPublicationPanel } from "./entry-editor-publication-panel.tsx";
import type { useEntryEditorQueries } from "./entry-editor-queries.ts";
import { EntryEditorStoryCanvas } from "./entry-editor-story-canvas.tsx";
import type { EditorialConfirmationStatus } from "./entry-editor-types.ts";

export const EntryEditorLayout = ({
  assets,
  authors,
  categories,
  contentTypeId,
  deleteEntry,
  editorialCommand,
  entryId,
  onRequestDeletion,
  onRequestEditorialConfirmation,
  onUpdateField,
  state,
  tags,
  title,
  titleField,
  values,
}: {
  readonly assets: readonly AssetRepresentation[] | undefined;
  readonly authors: readonly EntryRepresentation[] | undefined;
  readonly categories: readonly EntryRepresentation[] | undefined;
  readonly contentTypeId: string;
  readonly deleteEntry: ReturnType<typeof useEntryEditorDeleteMutation>;
  readonly editorialCommand: ReturnType<typeof useEntryEditorEditorialMutation>;
  readonly entryId: string;
  readonly onRequestDeletion: () => void;
  readonly onRequestEditorialConfirmation: (status: EditorialConfirmationStatus) => void;
  readonly onUpdateField: (key: string, value: unknown) => void;
  readonly state: ReturnType<typeof useEntryEditorQueries>["state"];
  readonly tags: readonly EntryRepresentation[] | undefined;
  readonly title: string;
  readonly titleField: string;
  readonly values: Record<string, unknown>;
}) => (
  <div className="editor-layout">
    <EntryEditorStoryCanvas
      assets={assets}
      contentTypeId={contentTypeId}
      onUpdateField={onUpdateField}
      title={title}
      titleField={titleField}
      values={values}
    />
    <aside className="editor-sidebar">
      <EntryEditorPublicationPanel
        authors={authors}
        categories={categories}
        contentTypeId={contentTypeId}
        editorialError={editorialCommand.error ?? undefined}
        isEditorialPending={editorialCommand.isPending}
        onRequestEditorialConfirmation={onRequestEditorialConfirmation}
        onUpdateField={onUpdateField}
        tags={tags}
        values={values}
      />
      <EntryEditorHistoryPanel
        contentTypeId={contentTypeId}
        entryId={entryId}
        writeToken={state.data?.writeToken}
      />
      <EntryEditorDangerPanel
        contentTypeId={contentTypeId}
        deleteErrorMessage={deleteEntry.error?.message}
        isDeleting={deleteEntry.isPending}
        onRequestDeletion={onRequestDeletion}
        saveDisabled={state.data === undefined}
      />
    </aside>
  </div>
);
