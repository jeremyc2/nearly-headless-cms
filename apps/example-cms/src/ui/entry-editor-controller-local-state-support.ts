import {
  type DeletionRecord,
  type Dispatch,
  type EditorialConfirmationStatus,
  type EntryConflict,
  type SetStateAction,
  createFieldUpdater,
  entryEditorControllerMutationsSupport,
  stringValue,
  titleFieldFrom,
  useEntryEditorQueries,
  useRef,
  useState,
} from "./entry-editor-controller-imports.ts";

const { useEntryEditorControllerMutations } = entryEditorControllerMutationsSupport,
  useEntryEditorControllerFieldBindings = <
    Values extends Record<string, unknown>,
    SetValues extends Dispatch<SetStateAction<Record<string, unknown>>>,
  >(input: {
    readonly setValues: Readonly<SetValues>;
    readonly values: Readonly<Values>;
  }) => {
    const title = stringValue(input.values[titleFieldFrom(input.values)], ""),
      titleField = titleFieldFrom(input.values),
      updateField = createFieldUpdater(input.setValues);
    return { title, titleField, updateField };
  },
  useEntryEditorControllerLocalState = () => {
    const { assets, authors, categories, contentTypeId, entryId, state, tags } =
        useEntryEditorQueries(),
      [confirmPurge, setConfirmPurge] = useState(false),
      [conflict, setConflict] = useState<EntryConflict | undefined>(),
      [deletionDialogOpen, setDeletionDialogOpen] = useState(false),
      [deletionRecord, setDeletionRecord] = useState<DeletionRecord | undefined>(),
      [editorialConfirmation, setEditorialConfirmation] = useState<
        EditorialConfirmationStatus | undefined
      >(),
      loadedEntryIdentifier = useRef<string | null>(null),
      [values, setValues] = useState<Record<string, unknown>>({});
    return {
      assets,
      authors,
      categories,
      confirmPurge,
      conflict,
      contentTypeId,
      deletionDialogOpen,
      deletionRecord,
      editorialConfirmation,
      entryId,
      loadedEntryIdentifier,
      setConfirmPurge,
      setConflict,
      setDeletionDialogOpen,
      setDeletionRecord,
      setEditorialConfirmation,
      setValues,
      state,
      tags,
      values,
    };
  },
  useEntryEditorControllerMutationBindings = <
    Input extends {
      readonly contentTypeId: string;
      readonly deletionRecord: DeletionRecord | undefined;
      readonly entryId: string;
      readonly setConflict: (value: EntryConflict | undefined) => void;
      readonly setDeletionDialogOpen: (value: boolean) => void;
      readonly setDeletionRecord: (value: DeletionRecord | undefined) => void;
      readonly setValues: Dispatch<SetStateAction<Record<string, unknown>>>;
      readonly state: ReturnType<typeof useEntryEditorQueries>["state"];
      readonly values: Record<string, unknown>;
    },
  >(
    input: Readonly<Input>,
  ) => {
    const mutations = useEntryEditorControllerMutations({
        contentTypeId: input.contentTypeId,
        deletionRecord: input.deletionRecord,
        entryId: input.entryId,
        onConflict: (latest) => {
          input.setConflict({ latest });
        },
        onDeleted: (receipt) => {
          input.setDeletionDialogOpen(false);
          input.setDeletionRecord(receipt);
        },
        onSaved: (savedValues: Readonly<Record<string, unknown>>) => {
          input.setValues(structuredClone(savedValues));
          input.setConflict(undefined);
        },
        onUpdated: (updatedValues: Readonly<Record<string, unknown>>) => {
          input.setValues(structuredClone(updatedValues));
        },
        writeToken: input.state.data?.writeToken,
      }),
      saveValues = (
        replacementValues = input.values,
        writeToken = input.state.data?.writeToken,
      ) => {
        mutations.save.mutate({ replacementValues, writeToken });
      };
    return { mutations, saveValues };
  };

export default {
  useEntryEditorControllerFieldBindings,
  useEntryEditorControllerLocalState,
  useEntryEditorControllerMutationBindings,
};
