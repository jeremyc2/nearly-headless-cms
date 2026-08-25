import {
  type AssetRepresentation,
  richTextDocumentFrom,
} from "./entry-editor-story-canvas-imports.ts";
import storyCanvasAssetsSupport from "./entry-editor-story-canvas-assets-support.tsx";
import storyCanvasFieldsSupport from "./entry-editor-story-canvas-fields-support.tsx";
/* oxlint-disable typescript/no-unnecessary-type-parameters -- React panel helpers preserve local prop aliases for component call sites. */

const { EntryEditorContentTypeAssetFields } = storyCanvasAssetsSupport,
  {
    EntryEditorAuthorProfileField,
    EntryEditorBodyFields,
    EntryEditorTextAreaFields,
    EntryEditorTitleField,
  } = storyCanvasFieldsSupport,
  EntryEditorStoryCanvas = <
    Values extends Record<string, unknown>,
    Asset extends AssetRepresentation,
    UpdateField extends (key: string, value: unknown) => void,
  >(
    props: {
      readonly assets: readonly Readonly<Asset>[] | undefined;
      readonly contentTypeId: string;
      readonly onUpdateField: UpdateField;
      readonly title: string;
      readonly titleField: string;
      readonly values: Readonly<Values>;
    },
  ) => (
    <section className="panel story-canvas">
      <p className="eyebrow">Story canvas</p>
      <EntryEditorStoryCanvasFields {...props} />
    </section>
  ),
  EntryEditorStoryCanvasFields = <
    Values extends Record<string, unknown>,
    Asset extends AssetRepresentation,
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

