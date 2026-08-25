import {
  type EditorialConfirmationStatus,
  type EntryRepresentation,
} from "./entry-editor-publication-panel-imports.ts";
import publicationPanelFieldsSupport from "./entry-editor-publication-panel-fields-support.tsx";
import publicationPanelSectionsSupport from "./entry-editor-publication-panel-sections-support.tsx";
/* oxlint-disable typescript/no-unnecessary-type-parameters -- React panel helpers preserve local prop aliases for component call sites. */

const { EntryEditorPublicationHeader } = publicationPanelFieldsSupport,
  { EntryEditorPublicationPanelSections } = publicationPanelSectionsSupport,
  EntryEditorPublicationPanel = <
    Values extends Record<string, unknown>,
    Author extends EntryRepresentation,
    Category extends EntryRepresentation,
    Tag extends EntryRepresentation,
    UpdateField extends (key: string, value: unknown) => void,
    RequestConfirmation extends (status: EditorialConfirmationStatus) => void,
    ErrorType extends Error,
  >(props: {
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
    <section className="panel">
      <EntryEditorPublicationHeader />
      <EntryEditorPublicationPanelSections {...props} />
    </section>
  );

export { EntryEditorPublicationPanel };

