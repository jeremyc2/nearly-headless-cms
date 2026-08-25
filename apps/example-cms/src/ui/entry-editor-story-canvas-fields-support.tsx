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
  EntryEditorBodyFields = ({
    bodyDocument,
    onUpdateField,
    values,
  }: {
    readonly bodyDocument: RichText.Document | undefined;
    readonly onUpdateField: (key: string, value: unknown) => void;
    readonly values: Record<string, unknown>;
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
  EntryEditorTextAreaFields = ({
    onUpdateField,
    values,
  }: {
    readonly onUpdateField: (key: string, value: unknown) => void;
    readonly values: Record<string, unknown>;
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
  EntryEditorTitleField = ({
    onUpdateField,
    title,
    titleField,
    values,
  }: {
    readonly onUpdateField: (key: string, value: unknown) => void;
    readonly title: string;
    readonly titleField: string;
    readonly values: Record<string, unknown>;
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
