import {
  EntryEditorRichTextFieldView,
  type RichText,
  entryEditorRichTextFieldSupport,
} from "./entry-editor-rich-text-field-bindings.ts";

const { useEntryEditorRichTextFieldState } = entryEditorRichTextFieldSupport,
  EntryEditorRichTextField = ({
    onChange,
    surfaceId,
    value,
  }: {
    readonly onChange: (document: RichText.Document) => void;
    readonly surfaceId: string;
    readonly value: RichText.Document;
  }) => {
    const fieldState = useEntryEditorRichTextFieldState(onChange, value);
    return <EntryEditorRichTextFieldView {...fieldState} surfaceId={surfaceId} />;
  };

export { EntryEditorRichTextField };
