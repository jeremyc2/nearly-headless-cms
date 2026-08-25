import {
  EntryEditorRichTextField,
  type RichText,
  stringValue,
  suggestedSlug,
} from "./entry-editor-story-canvas-imports.ts";

const EntryEditorAuthorProfileField = ({
    onUpdateField,
    profileDocument,
  }: {
    readonly onUpdateField: (key: string, value: unknown) => void;
    readonly profileDocument: RichText.Document;
  }) => (
    <div className="field full">
      <span>Author profile</span>
      <EntryEditorRichTextField
        onChange={(document) => {
          onUpdateField("profile", document);
        }}
        surfaceId="field-profile"
        value={profileDocument}
      />
    </div>
  ),
  EntryEditorBodyFields = <
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-139] React panel helpers preserve local prop aliases for component call sites.
    Values extends Record<string, unknown>,
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-139] React panel helpers preserve local prop aliases for component call sites.
    UpdateField extends (key: string, value: unknown) => void,
  >({
    bodyDocument,
    onUpdateField,
    values,
  }: {
    readonly bodyDocument: RichText.Document | undefined;
    readonly onUpdateField: UpdateField;
    readonly values: Readonly<Values>;
  }) => (
    <>
      {"body" in values && typeof values["body"] === "string" && (
        <label className="field full">
          <span>Body</span>
          <textarea
            onChange={(event) => {
              onUpdateField("body", event.target.value);
            }}
            rows={8}
            value={values["body"]}
          />
        </label>
      )}
      {bodyDocument !== undefined && (
        <EntryEditorRichTextField
          onChange={(document) => {
            onUpdateField("body", document);
          }}
          surfaceId="field-body"
          value={bodyDocument}
        />
      )}
    </>
  ),
  // oxlint-disable-next-line eslint/max-lines-per-function -- [EH-217] React panel helpers exceed function line budget after typed prop alias escape hatches.
  EntryEditorTextAreaFields = <
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-139] React panel helpers preserve local prop aliases for component call sites.
    Values extends Record<string, unknown>,
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-139] React panel helpers preserve local prop aliases for component call sites.
    UpdateField extends (key: string, value: unknown) => void,
  >({
    onUpdateField,
    values,
  }: {
    readonly onUpdateField: UpdateField;
    readonly values: Readonly<Values>;
  }) => (
    <>
      {"excerpt" in values && (
        <label className="field full">
          <span>Excerpt</span>
          <textarea
            onChange={(event) => {
              onUpdateField("excerpt", event.target.value);
            }}
            rows={4}
            value={String(values["excerpt"])}
          />
        </label>
      )}
      {"biography" in values && (
        <label className="field full">
          <span>Short biography</span>
          <textarea
            onChange={(event) => {
              onUpdateField("biography", event.target.value);
            }}
            rows={5}
            value={stringValue(values["biography"], "")}
          />
        </label>
      )}
      {"description" in values && (
        <label className="field full">
          <span>Description</span>
          <textarea
            onChange={(event) => {
              onUpdateField("description", event.target.value || null);
            }}
            rows={4}
            value={stringValue(values["description"], "")}
          />
        </label>
      )}
    </>
  ),
  EntryEditorTitleField = <
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-139] React panel helpers preserve local prop aliases for component call sites.
    Values extends Record<string, unknown>,
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-139] React panel helpers preserve local prop aliases for component call sites.
    UpdateField extends (key: string, value: unknown) => void,
  >({
    onUpdateField,
    title,
    titleField,
    values,
  }: {
    readonly onUpdateField: UpdateField;
    readonly title: string;
    readonly titleField: string;
    readonly values: Readonly<Values>;
  }) => (
    <>
      <label className="field full">
        <span>Title or name</span>
        <input
          onChange={(event) => {
            onUpdateField(titleField, event.target.value);
          }}
          value={title}
        />
      </label>
      {"slug" in values && (
        <div className="field">
          <label htmlFor="entry-slug">Slug</label>
          <input
            id="entry-slug"
            onChange={(event) => {
              onUpdateField("slug", event.target.value);
            }}
            value={String(values["slug"])}
          />
          <button
            className="text-button"
            onClick={() => {
              onUpdateField("slug", suggestedSlug(title));
            }}
            type="button"
          >
            Suggest from title or name
          </button>
        </div>
      )}
    </>
  );

export default {
  EntryEditorAuthorProfileField,
  EntryEditorBodyFields,
  EntryEditorTextAreaFields,
  EntryEditorTitleField,
};
