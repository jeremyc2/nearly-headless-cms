import { type EntryRepresentation } from "../generated/management-client.ts";
import type { EditorialConfirmationStatus } from "./entry-editor-types.ts";
import publicationPanelFieldsSupport from "./entry-editor-publication-panel-fields-support.tsx";
import publicationPanelSectionsSupport from "./entry-editor-publication-panel-sections-support.tsx";

const { EntryEditorPublicationHeader } = publicationPanelFieldsSupport,
  { EntryEditorPublicationPanelSections } = publicationPanelSectionsSupport,
  EntryEditorPublicationPanel = <
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-201] React panel helpers preserve local prop aliases for component call sites.
    Values extends Record<string, unknown>,
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-201] React panel helpers preserve local prop aliases for component call sites.
    Author extends EntryRepresentation,
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-201] React panel helpers preserve local prop aliases for component call sites.
    Category extends EntryRepresentation,
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-201] React panel helpers preserve local prop aliases for component call sites.
    Tag extends EntryRepresentation,
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-201] React panel helpers preserve local prop aliases for component call sites.
    UpdateField extends (key: string, value: unknown) => void,
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-201] React panel helpers preserve local prop aliases for component call sites.
    RequestConfirmation extends (status: EditorialConfirmationStatus) => void,
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-201] React panel helpers preserve local prop aliases for component call sites.
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
