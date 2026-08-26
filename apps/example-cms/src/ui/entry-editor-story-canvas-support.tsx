import {
  type AssetRepresentation,
  richTextDocumentFrom,
} from "./entry-editor-story-canvas-imports.ts";
import storyCanvasAssetsSupport from "./entry-editor-story-canvas-assets-support.tsx";
import storyCanvasFieldsSupport from "./entry-editor-story-canvas-fields-support.tsx";

const { EntryEditorContentTypeAssetFields } = storyCanvasAssetsSupport,
  {
    EntryEditorAuthorProfileField,
    EntryEditorBodyFields,
    EntryEditorTextAreaFields,
    EntryEditorTitleField,
  } = storyCanvasFieldsSupport,
  EntryEditorStoryCanvas = <
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-201] React panel helpers preserve local prop aliases for component call sites.
    Values extends Record<string, unknown>,
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-201] React panel helpers preserve local prop aliases for component call sites.
    Asset extends AssetRepresentation,
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-201] React panel helpers preserve local prop aliases for component call sites.
    UpdateField extends (key: string, value: unknown) => void,
  >(props: {
    readonly assets: readonly Readonly<Asset>[] | undefined;
    readonly contentTypeId: string;
    readonly onUpdateField: UpdateField;
    readonly title: string;
    readonly titleField: string;
    readonly values: Readonly<Values>;
  }) => (
    <section className="panel story-canvas">
      <p className="eyebrow">Story canvas</p>
      <EntryEditorStoryCanvasFields {...props} />
    </section>
  ),
  // oxlint-disable-next-line eslint/max-lines-per-function -- [EH-169] React panel helpers exceed function line budget after typed prop alias escape hatches.
  EntryEditorStoryCanvasFields = <
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-201] React panel helpers preserve local prop aliases for component call sites.
    Values extends Record<string, unknown>,
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-201] React panel helpers preserve local prop aliases for component call sites.
    Asset extends AssetRepresentation,
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-201] React panel helpers preserve local prop aliases for component call sites.
    UpdateField extends (key: string, value: unknown) => void,
  >({
    assets,
    contentTypeId,
    onUpdateField,
    title,
    titleField,
    values,
  }: {
    readonly assets: readonly Readonly<Asset>[] | undefined;
    readonly contentTypeId: string;
    readonly onUpdateField: UpdateField;
    readonly title: string;
    readonly titleField: string;
    readonly values: Readonly<Values>;
  }) => {
    const bodyDocument = richTextDocumentFrom(values["body"]),
      profileDocument = richTextDocumentFrom(values["profile"]);
    return (
      <>
        <EntryEditorTitleField
          onUpdateField={onUpdateField}
          title={title}
          titleField={titleField}
          values={values}
        />
        <EntryEditorTextAreaFields onUpdateField={onUpdateField} values={values} />
        <EntryEditorBodyFields
          bodyDocument={bodyDocument}
          onUpdateField={onUpdateField}
          values={values}
        />
        {profileDocument !== undefined && (
          <EntryEditorAuthorProfileField
            onUpdateField={onUpdateField}
            profileDocument={profileDocument}
          />
        )}
        <EntryEditorContentTypeAssetFields
          assets={assets}
          contentTypeId={contentTypeId}
          onUpdateField={onUpdateField}
          values={values}
        />
      </>
    );
  };

export { EntryEditorStoryCanvas };
