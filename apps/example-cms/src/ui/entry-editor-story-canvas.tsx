import type { AssetRepresentation } from "../generated/management-client.ts";
import { stringValue, suggestedSlug } from "./main-entry-support.ts";
import { assetSelectValue } from "./main-labels.ts";
import { richTextDocumentFrom } from "./main-shared.ts";
import { EntryEditorRichTextField } from "./entry-editor-rich-text-field.tsx";

export const EntryEditorStoryCanvas = ({
  assets,
  contentTypeId,
  onUpdateField,
  title,
  titleField,
  values,
}: {
  readonly assets: readonly AssetRepresentation[] | undefined;
  readonly contentTypeId: string;
  readonly onUpdateField: (key: string, value: unknown) => void;
  readonly title: string;
  readonly titleField: string;
  readonly values: Record<string, unknown>;
}) => {
  const bodyDocument = richTextDocumentFrom(values["body"]),
    profileDocument = richTextDocumentFrom(values["profile"]);
  return (
    <section className="panel story-canvas">
      <p className="eyebrow">Story canvas</p>
      <EntryEditorTitleField
        onUpdateField={onUpdateField}
        title={title}
        titleField={titleField}
        values={values}
      />
      <EntryEditorTextAreaFields onUpdateField={onUpdateField} values={values} />
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
      {profileDocument !== undefined && (
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
      )}
      {contentTypeId === "post" && (
        <EntryEditorFeaturedImage assets={assets} onUpdateField={onUpdateField} values={values} />
      )}
      {contentTypeId === "author" && (
        <EntryEditorPortrait assets={assets} onUpdateField={onUpdateField} values={values} />
      )}
    </section>
  );
};

const EntryEditorTitleField = ({
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

 EntryEditorFeaturedImage = ({
  assets,
  onUpdateField,
  values,
}: {
  readonly assets: readonly AssetRepresentation[] | undefined;
  readonly onUpdateField: (key: string, value: unknown) => void;
  readonly values: Record<string, unknown>;
}) => (
  <fieldset className="field-group full">
    <legend>Featured image</legend>
    <label className="field">
      <span>Immutable Asset</span>
      <select
        onChange={(event) => {
          const assetIdentifier = event.target.value,
            selectedAsset = assets?.find((candidate) => candidate.id === assetIdentifier);
          onUpdateField("featured-asset", assetIdentifier || null);
          if (
            selectedAsset?.metadata.defaultAlternativeText !== undefined &&
            (values["featured-alternative-text"] === undefined ||
              values["featured-alternative-text"] === null ||
              values["featured-alternative-text"] === "")
          ) {
            onUpdateField(
              "featured-alternative-text",
              selectedAsset.metadata.defaultAlternativeText,
            );
          }
        }}
        value={assetSelectValue(values["featured-asset"])}
      >
        <option value="">No featured Asset</option>
        {assets?.map((asset) => (
          <option key={asset.id} value={asset.id}>
            {asset.metadata.filename} · {asset.metadata.mediaType}
          </option>
        ))}
      </select>
    </label>
    <label className="field full">
      <span>Featured image alternative text</span>
      <input
        id="field-featured-alternative-text"
        onChange={(event) => {
          onUpdateField("featured-alternative-text", event.target.value || null);
        }}
        value={stringValue(values["featured-alternative-text"], "")}
      />
    </label>
    {typeof values["featured-asset"] === "string" && (
      <p className="field-help">
        {assets?.find((asset) => asset.id === values["featured-asset"])?.metadata.filename ??
          "Selected immutable Asset"}
      </p>
    )}
  </fieldset>
),

 EntryEditorPortrait = ({
  assets,
  onUpdateField,
  values,
}: {
  readonly assets: readonly AssetRepresentation[] | undefined;
  readonly onUpdateField: (key: string, value: unknown) => void;
  readonly values: Record<string, unknown>;
}) => (
  <fieldset className="field-group full">
    <legend>Portrait</legend>
    <label className="field">
      <span>Immutable Asset</span>
      <select
        onChange={(event) => {
          onUpdateField("portrait", event.target.value || null);
        }}
        value={assetSelectValue(values["portrait"])}
      >
        <option value="">No portrait</option>
        {assets?.map((asset) => (
          <option key={asset.id} value={asset.id}>
            {asset.metadata.filename}
          </option>
        ))}
      </select>
    </label>
    <label className="field full">
      <span>Portrait alternative text</span>
      <input
        onChange={(event) => {
          onUpdateField("portrait-alternative-text", event.target.value || null);
        }}
        value={stringValue(values["portrait-alternative-text"], "")}
      />
    </label>
  </fieldset>
);
