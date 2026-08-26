import {
  type EditorialConfirmationStatus,
  type EntryRepresentation,
  displayName,
  editorialButtonLabel,
  editorialIssues,
  editorialStatus,
  featuredAlternativeTextField,
  publicationInputValue,
  publicationValue,
  stringArrayValue,
  stringValue,
} from "./entry-editor-publication-panel-imports.ts";

const EntryEditorAuthorField = <
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-139] React panel helpers preserve local prop aliases for component call sites.
    Values extends Record<string, unknown>,
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-139] React panel helpers preserve local prop aliases for component call sites.
    Author extends EntryRepresentation,
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-139] React panel helpers preserve local prop aliases for component call sites.
    UpdateField extends (key: string, value: unknown) => void,
  >({
    authors,
    onUpdateField,
    values,
  }: {
    readonly authors: readonly Readonly<Author>[] | undefined;
    readonly onUpdateField: UpdateField;
    readonly values: Readonly<Values>;
  }) => (
    <label className="field">
      <span>Author</span>
      <select
        onChange={(event) => {
          onUpdateField("author", event.target.value);
        }}
        value={stringValue(values["author"], "")}
      >
        {authors?.map((author) => (
          <option key={author.id} value={author.id}>
            {displayName(author)}
          </option>
        ))}
      </select>
      <small>The Author describes the content; it is not a login identity.</small>
    </label>
  ),
  EntryEditorCategoryField = <
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-139] React panel helpers preserve local prop aliases for component call sites.
    Values extends Record<string, unknown>,
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-139] React panel helpers preserve local prop aliases for component call sites.
    Category extends EntryRepresentation,
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-139] React panel helpers preserve local prop aliases for component call sites.
    UpdateField extends (key: string, value: unknown) => void,
  >({
    categories,
    onUpdateField,
    values,
  }: {
    readonly categories: readonly Readonly<Category>[] | undefined;
    readonly onUpdateField: UpdateField;
    readonly values: Readonly<Values>;
  }) => (
    <label className="field">
      <span>Categories</span>
      <select
        multiple
        onChange={(event) => {
          onUpdateField(
            "categories",
            [...event.currentTarget.selectedOptions].map((option) => option.value),
          );
        }}
        value={stringArrayValue(values["categories"])}
      >
        {categories?.map((category) => (
          <option key={category.id} value={category.id}>
            {displayName(category)}
          </option>
        ))}
      </select>
    </label>
  ),
  EntryEditorCommentActions = <
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-139] React panel helpers preserve local prop aliases for component call sites.
    RequestConfirmation extends (status: EditorialConfirmationStatus) => void,
  >({
    isEditorialPending,
    onRequestEditorialConfirmation,
  }: {
    readonly isEditorialPending: boolean;
    readonly onRequestEditorialConfirmation: RequestConfirmation;
  }) => (
    <div className="editor-actions">
      <button
        className="primary-button"
        disabled={isEditorialPending}
        onClick={() => {
          onRequestEditorialConfirmation("approved");
        }}
        type="button"
      >
        Approve
      </button>
      <button
        className="secondary-button"
        disabled={isEditorialPending}
        onClick={() => {
          onRequestEditorialConfirmation("rejected");
        }}
        type="button"
      >
        Reject
      </button>
    </div>
  ),
  EntryEditorEditorialError = <ErrorType extends Error>({
    error,
  }: {
    readonly error: Readonly<ErrorType>;
  }) => (
    <div className="error-state issue-summary" role="alert">
      <strong>{error.message}</strong>
      {editorialIssues(error).length > 0 && (
        <ul>
          {editorialIssues(error).map((issue) => {
            const rootField = String(issue.path[0] ?? "body"),
              targetIdentifier = featuredAlternativeTextField(rootField);
            return (
              <li key={`${issue.path.join(".")}-${issue.reason}`}>
                <a href={`#${targetIdentifier}`}>
                  {issue.path.join(" → ")}: {issue.reason}
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  ),
  EntryEditorPostEditorialButton = <
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-139] React panel helpers preserve local prop aliases for component call sites.
    Values extends Record<string, unknown>,
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-139] React panel helpers preserve local prop aliases for component call sites.
    RequestConfirmation extends (status: EditorialConfirmationStatus) => void,
  >({
    isEditorialPending,
    onRequestEditorialConfirmation,
    values,
  }: {
    readonly isEditorialPending: boolean;
    readonly onRequestEditorialConfirmation: RequestConfirmation;
    readonly values: Readonly<Values>;
  }) => (
    <button
      className="full-button primary-button"
      disabled={isEditorialPending}
      onClick={() => {
        onRequestEditorialConfirmation(editorialStatus(values["status"]));
      }}
      type="button"
    >
      {editorialButtonLabel(values["status"])}
    </button>
  ),
  EntryEditorPostRelationships = <
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-139] React panel helpers preserve local prop aliases for component call sites.
    Values extends Record<string, unknown>,
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-139] React panel helpers preserve local prop aliases for component call sites.
    Author extends EntryRepresentation,
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-139] React panel helpers preserve local prop aliases for component call sites.
    Category extends EntryRepresentation,
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-139] React panel helpers preserve local prop aliases for component call sites.
    Tag extends EntryRepresentation,
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-139] React panel helpers preserve local prop aliases for component call sites.
    UpdateField extends (key: string, value: unknown) => void,
  >({
    authors,
    categories,
    onUpdateField,
    tags,
    values,
  }: {
    readonly authors: readonly Readonly<Author>[] | undefined;
    readonly categories: readonly Readonly<Category>[] | undefined;
    readonly onUpdateField: UpdateField;
    readonly tags: readonly Readonly<Tag>[] | undefined;
    readonly values: Readonly<Values>;
  }) => (
    <>
      <EntryEditorAuthorField authors={authors} onUpdateField={onUpdateField} values={values} />
      <EntryEditorCategoryField
        categories={categories}
        onUpdateField={onUpdateField}
        values={values}
      />
      <EntryEditorTagField onUpdateField={onUpdateField} tags={tags} values={values} />
      <label className="field">
        <span>Publication time</span>
        <input
          onChange={(event) => {
            onUpdateField("published-at", publicationValue(event.target.value));
          }}
          type="datetime-local"
          value={publicationInputValue(values["published-at"])}
        />
      </label>
    </>
  ),
  EntryEditorPublicationBoundaryNote = () => (
    <p className="boundary-note">
      Saving changes the CMS. Publishing makes a Post eligible for the next static build.
    </p>
  ),
  EntryEditorPublicationHeader = () => (
    <>
      <p className="eyebrow">Publication</p>
      <h2>CMS state</h2>
    </>
  ),
  EntryEditorPublicationStatusField = <Values extends Record<string, unknown>>({
    values,
  }: {
    readonly values: Readonly<Values>;
  }) =>
    "status" in values && (
      <div className="field">
        <span>Status</span>
        <output className="status-readout">{stringValue(values["status"], "active")}</output>
        <small>Status changes only through the explicit editorial command below.</small>
      </div>
    ),
  EntryEditorTagField = <
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-139] React panel helpers preserve local prop aliases for component call sites.
    Values extends Record<string, unknown>,
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-139] React panel helpers preserve local prop aliases for component call sites.
    Tag extends EntryRepresentation,
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-139] React panel helpers preserve local prop aliases for component call sites.
    UpdateField extends (key: string, value: unknown) => void,
  >({
    onUpdateField,
    tags,
    values,
  }: {
    readonly onUpdateField: UpdateField;
    readonly tags: readonly Readonly<Tag>[] | undefined;
    readonly values: Readonly<Values>;
  }) => (
    <label className="field">
      <span>Tags</span>
      <select
        multiple
        onChange={(event) => {
          onUpdateField(
            "tags",
            [...event.currentTarget.selectedOptions].map((option) => option.value),
          );
        }}
        value={stringArrayValue(values["tags"])}
      >
        {tags?.map((tag) => (
          <option key={tag.id} value={tag.id}>
            {displayName(tag)}
          </option>
        ))}
      </select>
    </label>
  );

export default {
  EntryEditorCommentActions,
  EntryEditorEditorialError,
  EntryEditorPostEditorialButton,
  EntryEditorPostRelationships,
  EntryEditorPublicationBoundaryNote,
  EntryEditorPublicationHeader,
  EntryEditorPublicationStatusField,
};
