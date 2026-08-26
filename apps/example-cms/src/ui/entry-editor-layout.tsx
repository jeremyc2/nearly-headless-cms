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

export const EntryEditorLayout = <Properties extends EntryEditorLayoutProperties>(
    properties: Readonly<Properties>,
  ) => (
    <div className="editor-layout">
      <EntryEditorStoryCanvas
        assets={properties.assets}
        contentTypeId={properties.contentTypeId}
        onUpdateField={properties.onUpdateField}
        title={properties.title}
        titleField={properties.titleField}
        values={properties.values}
      />
      <EntryEditorLayoutSidebar
        authors={properties.authors}
        categories={properties.categories}
        contentTypeId={properties.contentTypeId}
        deleteEntry={properties.deleteEntry}
        editorialCommand={properties.editorialCommand}
        entryId={properties.entryId}
        onRequestDeletion={properties.onRequestDeletion}
        onRequestEditorialConfirmation={properties.onRequestEditorialConfirmation}
        onUpdateField={properties.onUpdateField}
        state={properties.state}
        tags={properties.tags}
        values={properties.values}
      />
    </div>
  ),
  EntryEditorLayoutSidebar = <
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-139] React panel helpers preserve local prop aliases for component call sites.
    Properties extends Omit<EntryEditorLayoutProperties, "assets" | "title" | "titleField">,
  >(
    properties: Readonly<Properties>,
  ) => (
    <aside className="editor-sidebar">
      <EntryEditorPublicationPanel
        authors={properties.authors}
        categories={properties.categories}
        contentTypeId={properties.contentTypeId}
        editorialError={properties.editorialCommand.error ?? undefined}
        isEditorialPending={properties.editorialCommand.isPending}
        onRequestEditorialConfirmation={properties.onRequestEditorialConfirmation}
        onUpdateField={properties.onUpdateField}
        tags={properties.tags}
        values={properties.values}
      />
      <EntryEditorHistoryPanel
        contentTypeId={properties.contentTypeId}
        entryId={properties.entryId}
        writeToken={properties.state.data?.writeToken}
      />
      <EntryEditorDangerPanel
        contentTypeId={properties.contentTypeId}
        deleteErrorMessage={properties.deleteEntry.error?.message}
        isDeleting={properties.deleteEntry.isPending}
        onRequestDeletion={properties.onRequestDeletion}
        saveDisabled={properties.state.data === undefined}
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
