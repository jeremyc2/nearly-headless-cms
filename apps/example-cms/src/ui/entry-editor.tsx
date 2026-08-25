import { EntryEditorConflictPanel } from "./entry-editor-conflict-panel.tsx";
import { EntryEditorHeader } from "./entry-editor-header.tsx";
import { EntryEditorLayout } from "./entry-editor-layout.tsx";
import { EntryEditorOverlays } from "./entry-editor-overlays.tsx";
import { useEntryEditorController } from "./entry-editor-controller.ts";

export const EntryEditor = () => {
    const controller = useEntryEditorController();
    return (
      <div className="editor-page page">
        <EntryEditorHeader
          contentTypeId={controller.contentTypeId}
          isSaving={controller.save.isPending}
          onSave={controller.saveValues}
          revisionNumber={controller.state.data?.revisionNumber}
          saveDisabled={controller.save.isPending || controller.state.data === undefined}
          title={controller.title}
        />
        <EntryEditorAlerts controller={controller} />
        {controller.state.isLoading && <p>Loading current state…</p>}
        {!controller.state.isLoading && <EntryEditorLoadedContent controller={controller} />}
        <EntryEditorOverlays controller={controller} />
      </div>
    );
  },
  EntryEditorAlerts = <Controller extends ReturnType<typeof useEntryEditorController>>({
    controller,
  }: {
    readonly controller: Readonly<Controller>;
  }) => (
    <>
      {controller.save.error && (
        <p className="error-state" role="alert">
          {controller.save.error.message}
        </p>
      )}
      {controller.conflict !== undefined && (
        <EntryEditorConflictPanel
          conflict={controller.conflict}
          contentTypeId={controller.contentTypeId}
          entryId={controller.entryId}
          isSaving={controller.save.isPending}
          onDiscard={controller.discardConflict}
          onReapply={controller.reapplyConflict}
          values={controller.values}
        />
      )}
    </>
  ),
  EntryEditorLoadedContent = <Controller extends ReturnType<typeof useEntryEditorController>>({
    controller,
  }: {
    readonly controller: Readonly<Controller>;
  }) => (
    <EntryEditorLayout
      assets={controller.assets.data}
      authors={controller.authors.data?.items}
      categories={controller.categories.data?.items}
      contentTypeId={controller.contentTypeId}
      deleteEntry={controller.deleteEntry}
      editorialCommand={controller.editorialCommand}
      entryId={controller.entryId}
      onRequestDeletion={controller.requestDeletion}
      onRequestEditorialConfirmation={controller.requestEditorialConfirmation}
      onUpdateField={controller.updateField}
      state={controller.state}
      tags={controller.tags.data?.items}
      title={controller.title}
      titleField={controller.titleField}
      values={controller.values}
    />
  );
