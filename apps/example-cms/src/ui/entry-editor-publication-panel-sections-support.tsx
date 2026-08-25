import {
  type EditorialConfirmationStatus,
  type EntryRepresentation,
} from "./entry-editor-publication-panel-imports.ts";
import publicationPanelFieldsSupport from "./entry-editor-publication-panel-fields-support.tsx";
/* oxlint-disable typescript/no-unnecessary-type-parameters -- [EH-139] React panel helpers preserve local prop aliases for component call sites. */

const {
  EntryEditorCommentActions,
  EntryEditorEditorialError,
  EntryEditorPostEditorialButton,
  EntryEditorPostRelationships,
  EntryEditorPublicationBoundaryNote,
  EntryEditorPublicationStatusField,
} = publicationPanelFieldsSupport,
  EntryEditorPublicationPanelEditorial = <
    Values extends Record<string, unknown>,
    RequestConfirmation extends (status: EditorialConfirmationStatus) => void,
    ErrorType extends Error,
  >({
    contentTypeId,
    editorialError,
    isEditorialPending,
    onRequestEditorialConfirmation,
    values,
  }: {
    readonly contentTypeId: string;
    readonly editorialError?: Readonly<ErrorType>;
    readonly isEditorialPending: boolean;
    readonly onRequestEditorialConfirmation: RequestConfirmation;
    readonly values: Readonly<Values>;
  }) => (
    <>
      {editorialError !== undefined && <EntryEditorEditorialError error={editorialError} />}
      {contentTypeId === "post" && (
        <EntryEditorPostEditorialButton
          isEditorialPending={isEditorialPending}
          onRequestEditorialConfirmation={onRequestEditorialConfirmation}
          values={values}
        />
      )}
      {contentTypeId === "comment" && (
        <EntryEditorCommentActions
          isEditorialPending={isEditorialPending}
          onRequestEditorialConfirmation={onRequestEditorialConfirmation}
        />
      )}
    </>
  ),
  EntryEditorPublicationPanelSections = <
    Values extends Record<string, unknown>,
    Author extends EntryRepresentation,
    Category extends EntryRepresentation,
    Tag extends EntryRepresentation,
    UpdateField extends (key: string, value: unknown) => void,
    RequestConfirmation extends (status: EditorialConfirmationStatus) => void,
    ErrorType extends Error,
  >({
    authors,
    categories,
    contentTypeId,
    editorialError,
    isEditorialPending,
    onRequestEditorialConfirmation,
    onUpdateField,
    tags,
    values,
  }: {
    readonly authors: readonly Readonly<Author>[] | undefined;
    readonly categories: readonly Readonly<Category>[] | undefined;
    readonly contentTypeId: string;
    readonly editorialError?: Readonly<ErrorType>;
    readonly isEditorialPending: boolean;
    readonly onRequestEditorialConfirmation: RequestConfirmation;
    readonly onUpdateField: UpdateField;
    readonly tags: readonly Readonly<Tag>[] | undefined;
    readonly values: Readonly<Values>;
  }) => (
    <>
      {contentTypeId === "post" && (
        <EntryEditorPostRelationships
          authors={authors}
          categories={categories}
          onUpdateField={onUpdateField}
          tags={tags}
          values={values}
        />
      )}
      <EntryEditorPublicationStatusField values={values} />
      <EntryEditorPublicationBoundaryNote />
      <EntryEditorPublicationPanelEditorial
        contentTypeId={contentTypeId}
        editorialError={editorialError}
        isEditorialPending={isEditorialPending}
        onRequestEditorialConfirmation={onRequestEditorialConfirmation}
        values={values}
      />
    </>
  );

export default { EntryEditorPublicationPanelSections };
