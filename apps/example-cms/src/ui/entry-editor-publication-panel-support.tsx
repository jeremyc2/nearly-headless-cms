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

const EntryEditorAuthorField = ({
    authors,
    onUpdateField,
    values,
  }: {
    readonly authors: readonly EntryRepresentation[] | undefined;
    readonly onUpdateField: (key: string, value: unknown) => void;
    readonly values: Record<string, unknown>;
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
  EntryEditorCategoryField = ({
    categories,
    onUpdateField,
    values,
  }: {
    readonly categories: readonly EntryRepresentation[] | undefined;
    readonly onUpdateField: (key: string, value: unknown) => void;
    readonly values: Record<string, unknown>;
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
  EntryEditorCommentActions = ({
    isEditorialPending,
    onRequestEditorialConfirmation,
  }: {
    readonly isEditorialPending: boolean;
    readonly onRequestEditorialConfirmation: (status: EditorialConfirmationStatus) => void;
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
  EntryEditorEditorialError = ({ error }: { readonly error: Error }) => (
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
  EntryEditorPostEditorialButton = ({
    isEditorialPending,
    onRequestEditorialConfirmation,
    values,
  }: {
    readonly isEditorialPending: boolean;
    readonly onRequestEditorialConfirmation: (status: EditorialConfirmationStatus) => void;
    readonly values: Record<string, unknown>;
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
  EntryEditorPostRelationships = ({
    authors,
    categories,
    onUpdateField,
    tags,
    values,
  }: {
    readonly authors: readonly EntryRepresentation[] | undefined;
    readonly categories: readonly EntryRepresentation[] | undefined;
    readonly onUpdateField: (key: string, value: unknown) => void;
    readonly tags: readonly EntryRepresentation[] | undefined;
    readonly values: Record<string, unknown>;
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
  EntryEditorPublicationPanel = ({
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
    readonly authors: readonly EntryRepresentation[] | undefined;
    readonly categories: readonly EntryRepresentation[] | undefined;
    readonly contentTypeId: string;
    readonly editorialError?: Error;
    readonly isEditorialPending: boolean;
    readonly onRequestEditorialConfirmation: (status: EditorialConfirmationStatus) => void;
    readonly onUpdateField: (key: string, value: unknown) => void;
    readonly tags: readonly EntryRepresentation[] | undefined;
    readonly values: Record<string, unknown>;
  }) => (
    <section className="panel">
      <EntryEditorPublicationHeader />
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
    </section>
  ),
  EntryEditorPublicationStatusField = ({
    values,
  }: {
    readonly values: Record<string, unknown>;
  }) =>
    "status" in values && (
      <div className="field">
        <span>Status</span>
        <output className="status-readout">{stringValue(values["status"], "active")}</output>
        <small>Status changes only through the explicit editorial command below.</small>
      </div>
    ),
  EntryEditorTagField = ({
    onUpdateField,
    tags,
    values,
  }: {
    readonly onUpdateField: (key: string, value: unknown) => void;
    readonly tags: readonly EntryRepresentation[] | undefined;
    readonly values: Record<string, unknown>;
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

export { EntryEditorPublicationPanel };
