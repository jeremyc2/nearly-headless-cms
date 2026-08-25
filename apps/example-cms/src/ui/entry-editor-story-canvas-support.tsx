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
  EntryEditorStoryCanvas = ({
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
      </section>
    );
  };

export { EntryEditorStoryCanvas };
