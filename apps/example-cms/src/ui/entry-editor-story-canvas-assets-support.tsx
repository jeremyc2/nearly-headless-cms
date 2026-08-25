import {
  type AssetRepresentation,
  assetSelectValue,
  stringValue,
} from "./entry-editor-story-canvas-imports.ts";
/* oxlint-disable typescript/no-unnecessary-type-parameters -- [EH-139] React panel helpers preserve local prop aliases for component call sites. */

const EntryEditorContentTypeAssetFields = <
    Values extends Record<string, unknown>,
    Asset extends AssetRepresentation,
    UpdateField extends (key: string, value: unknown) => void,
  >({
    assets,
    contentTypeId,
    onUpdateField,
    values,
  }: {
    readonly assets: readonly Readonly<Asset>[] | undefined;
    readonly contentTypeId: string;
    readonly onUpdateField: UpdateField;
    readonly values: Readonly<Values>;
  }) => (
    <>
      {contentTypeId === "post" && (
        <EntryEditorFeaturedImage assets={assets} onUpdateField={onUpdateField} values={values} />
      )}
      {contentTypeId === "author" && (
        <EntryEditorPortrait assets={assets} onUpdateField={onUpdateField} values={values} />
      )}
    </>
  ),
  EntryEditorFeaturedImage = <
    Values extends Record<string, unknown>,
    Asset extends AssetRepresentation,
    UpdateField extends (key: string, value: unknown) => void,
  >({
    assets,
    onUpdateField,
    values,
  }: {
    readonly assets: readonly Readonly<Asset>[] | undefined;
    readonly onUpdateField: UpdateField;
    readonly values: Readonly<Values>;
  }) => (
    <fieldset className="field-group full">
      <legend>Featured image</legend>
      <EntryEditorFeaturedImageSelect
        assets={assets}
        onUpdateField={onUpdateField}
        values={values}
      />
      <EntryEditorFeaturedImageAlternativeText onUpdateField={onUpdateField} values={values} />
      {typeof values["featured-asset"] === "string" && (
        <p className="field-help">
          {assets?.find((asset) => asset.id === values["featured-asset"])?.metadata.filename ??
            "Selected immutable Asset"}
        </p>
      )}
    </fieldset>
  ),
  EntryEditorFeaturedImageAlternativeText = <
    Values extends Record<string, unknown>,
    UpdateField extends (key: string, value: unknown) => void,
  >({
    onUpdateField,
    values,
  }: {
    readonly onUpdateField: UpdateField;
    readonly values: Readonly<Values>;
  }) => (
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
  ),
  EntryEditorFeaturedImageSelect = <
    Values extends Record<string, unknown>,
    Asset extends AssetRepresentation,
    UpdateField extends (key: string, value: unknown) => void,
  >({
    assets,
    onUpdateField,
    values,
  }: {
    readonly assets: readonly Readonly<Asset>[] | undefined;
    readonly onUpdateField: UpdateField;
    readonly values: Readonly<Values>;
  }) => (
    <label className="field">
      <span>Immutable Asset</span>
      <select
        onChange={(event) => {
          applyFeaturedAssetSelection({
            assetIdentifier: event.target.value,
            assets,
            onUpdateField,
            values,
          });
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
  ),
  EntryEditorPortrait = <
    Values extends Record<string, unknown>,
    Asset extends AssetRepresentation,
    UpdateField extends (key: string, value: unknown) => void,
  >({
    assets,
    onUpdateField,
    values,
  }: {
    readonly assets: readonly Readonly<Asset>[] | undefined;
    readonly onUpdateField: UpdateField;
    readonly values: Readonly<Values>;
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
  ),
  applyFeaturedAssetSelection = <
    Input extends {
      assetIdentifier: string;
      assets: readonly AssetRepresentation[] | undefined;
      onUpdateField: (key: string, value: unknown) => void;
      values: Record<string, unknown>;
    },
  >(
    input: Readonly<Input>,
  ): void => {
    const selectedAsset = input.assets?.find((candidate) => candidate.id === input.assetIdentifier);
    input.onUpdateField("featured-asset", input.assetIdentifier || null);
    if (
      selectedAsset?.metadata.defaultAlternativeText !== undefined &&
      (input.values["featured-alternative-text"] === undefined ||
        input.values["featured-alternative-text"] === null ||
        input.values["featured-alternative-text"] === "")
    ) {
      input.onUpdateField(
        "featured-alternative-text",
        selectedAsset.metadata.defaultAlternativeText,
      );
    }
  };

export default {
  EntryEditorContentTypeAssetFields,
};
