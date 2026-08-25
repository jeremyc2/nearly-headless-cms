import {
  type AssetRepresentation,
  type EditorialConfirmationStatus,
  EntryEditorDangerPanel,
  EntryEditorHistoryPanel,
  EntryEditorPublicationPanel,
  EntryEditorStoryCanvas,
  type EntryRepresentation,
  type useEntryEditorDeleteMutation,
  type useEntryEditorEditorialMutation,
  type useEntryEditorQueries,
} from "./entry-editor-layout-imports.ts";

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
}: EntryEditorLayoutProperties) => (
  <div className="editor-layout">
    <EntryEditorStoryCanvas
      assets={assets}
      contentTypeId={contentTypeId}
      onUpdateField={onUpdateField}
      title={title}
      titleField={titleField}
      values={values}
    />
    <EntryEditorLayoutSidebar
      authors={authors}
      categories={categories}
      contentTypeId={contentTypeId}
      deleteEntry={deleteEntry}
      editorialCommand={editorialCommand}
      entryId={entryId}
      onRequestDeletion={onRequestDeletion}
      onRequestEditorialConfirmation={onRequestEditorialConfirmation}
      onUpdateField={onUpdateField}
      state={state}
      tags={tags}
      values={values}
    />
  </div>
),

EntryEditorLayoutSidebar = ({
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
  values,
}: Omit<EntryEditorLayoutProperties, "assets" | "title" | "titleField">) => (
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
);

interface EntryEditorLayoutProperties {
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
}
