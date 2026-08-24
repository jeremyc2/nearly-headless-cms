import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  useEntryEditorDeleteMutation,
  useEntryEditorEditorialMutation,
  useEntryEditorPurgeMutation,
  useEntryEditorSaveMutation,
} from "./entry-editor-mutations.ts";
import { useEntryEditorQueries } from "./entry-editor-queries.ts";
import { createFieldUpdater, titleFieldFrom } from "./entry-editor-support.ts";
import { stringValue } from "./main-entry-support.ts";
import type {
  DeletionRecord,
  EditorialConfirmationStatus,
  EntryConflict,
} from "./entry-editor-types.ts";

export const useEntryEditorController = () => {
  const navigate = useNavigate(),
    queries = useEntryEditorQueries(),
    { assets, authors, categories, contentTypeId, entryId, state, tags } = queries,
    [confirmPurge, setConfirmPurge] = useState(false),
    [conflict, setConflict] = useState<EntryConflict | undefined>(),
    [deletionDialogOpen, setDeletionDialogOpen] = useState(false),
    [deletionRecord, setDeletionRecord] = useState<DeletionRecord | undefined>(),
    [editorialConfirmation, setEditorialConfirmation] = useState<
      EditorialConfirmationStatus | undefined
    >(),
    [values, setValues] = useState<Record<string, unknown>>({}),
    loadedEntryIdentifier = useRef<string | null>(null),
    mutations = useEntryEditorControllerMutations({
      contentTypeId,
      deletionRecord,
      entryId,
      onConflict: (latest) => {
        setConflict({ latest });
      },
      onDeleted: (receipt) => {
        setDeletionDialogOpen(false);
        setDeletionRecord(receipt);
      },
      onSaved: (savedValues) => {
        setValues(structuredClone(savedValues));
        setConflict(undefined);
      },
      onUpdated: (updatedValues) => {
        setValues(structuredClone(updatedValues));
      },
      writeToken: state.data?.writeToken,
    }),
    titleField = titleFieldFrom(values),
    title = stringValue(values[titleField], ""),
    updateField = createFieldUpdater(setValues),
    saveValues = (replacementValues = values, writeToken = state.data?.writeToken) => {
      mutations.save.mutate({ replacementValues, writeToken });
    };
  useEffect(() => {
    if (state.data !== undefined && loadedEntryIdentifier.current !== entryId) {
      loadedEntryIdentifier.current = entryId;
      setValues(structuredClone(state.data.entry.values));
      setConflict(undefined);
    }
  }, [entryId, state.data]);
  return useEntryEditorControllerView({
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
    mutations,
    navigate,
    saveValues,
    setConfirmPurge,
    setConflict,
    setDeletionDialogOpen,
    setEditorialConfirmation,
    setValues,
    state,
    tags,
    title,
    titleField,
    updateField,
    values,
  });
};

function useEntryEditorControllerMutations({
  contentTypeId,
  deletionRecord,
  entryId,
  onConflict,
  onDeleted,
  onSaved,
  onUpdated,
  writeToken,
}: {
  readonly contentTypeId: string;
  readonly deletionRecord?: DeletionRecord;
  readonly entryId: string;
  readonly onConflict: (latest: EntryConflict["latest"]) => void;
  readonly onDeleted: (receipt: DeletionRecord) => void;
  readonly onSaved: (values: Record<string, unknown>) => void;
  readonly onUpdated: (values: Record<string, unknown>) => void;
  readonly writeToken?: string;
}) {
  const deleteEntry = useEntryEditorDeleteMutation({
      contentTypeId,
      entryId,
      onDeleted,
      writeToken,
    }),
    editorialCommand = useEntryEditorEditorialMutation({
      contentTypeId,
      entryId,
      onUpdated,
      writeToken,
    }),
    permanentlyPurge = useEntryEditorPurgeMutation({ contentTypeId, deletionRecord }),
    save = useEntryEditorSaveMutation({
      contentTypeId,
      entryId,
      onConflict,
      onSaved,
    });
  return { deleteEntry, editorialCommand, permanentlyPurge, save };
}

function useEntryEditorControllerView({
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
  mutations,
  navigate,
  saveValues,
  setConfirmPurge,
  setConflict,
  setDeletionDialogOpen,
  setEditorialConfirmation,
  setValues,
  state,
  tags,
  title,
  titleField,
  updateField,
  values,
}: {
  readonly assets: ReturnType<typeof useEntryEditorQueries>["assets"];
  readonly authors: ReturnType<typeof useEntryEditorQueries>["authors"];
  readonly categories: ReturnType<typeof useEntryEditorQueries>["categories"];
  readonly confirmPurge: boolean;
  readonly conflict: EntryConflict | undefined;
  readonly contentTypeId: string;
  readonly deletionDialogOpen: boolean;
  readonly deletionRecord: DeletionRecord | undefined;
  readonly editorialConfirmation: EditorialConfirmationStatus | undefined;
  readonly entryId: string;
  readonly mutations: ReturnType<typeof useEntryEditorControllerMutations>;
  readonly navigate: ReturnType<typeof useNavigate>;
  readonly saveValues: (replacementValues?: Record<string, unknown>, writeToken?: string) => void;
  readonly setConfirmPurge: (value: boolean) => void;
  readonly setConflict: (value: EntryConflict | undefined) => void;
  readonly setDeletionDialogOpen: (value: boolean) => void;
  readonly setEditorialConfirmation: (value: EditorialConfirmationStatus | undefined) => void;
  readonly setValues: (value: Record<string, unknown>) => void;
  readonly state: ReturnType<typeof useEntryEditorQueries>["state"];
  readonly tags: ReturnType<typeof useEntryEditorQueries>["tags"];
  readonly title: string;
  readonly titleField: string;
  readonly updateField: ReturnType<typeof createFieldUpdater>;
  readonly values: Record<string, unknown>;
}) {
  return {
  assets,
  authors,
  cancelDeletion: () => {
    setDeletionDialogOpen(false);
  },
  cancelEditorialConfirmation: () => {
    setEditorialConfirmation(undefined);
  },
  cancelPurge: () => {
    setConfirmPurge(false);
  },
  categories,
  confirmEditorialChange: (status: EditorialConfirmationStatus) => {
    mutations.editorialCommand.mutate(status);
    setEditorialConfirmation(undefined);
  },
  confirmPurge,
  confirmPurgeAction: () => {
    mutations.permanentlyPurge.mutate();
  },
  conflict,
  contentTypeId,
  deleteEntry: mutations.deleteEntry,
  deletionDialogOpen,
  deletionRecord,
  discardConflict: (latestValues: Record<string, unknown>) => {
    setValues(structuredClone(latestValues));
    setConflict(undefined);
  },
  editorialCommand: mutations.editorialCommand,
  editorialConfirmation,
  entryId,
  permanentlyPurge: mutations.permanentlyPurge,
  reapplyConflict: () => {
    if (conflict !== undefined) {
      saveValues(values, conflict.latest.writeToken);
    }
  },
  requestDeletion: () => {
    setDeletionDialogOpen(true);
  },
  requestEditorialConfirmation: setEditorialConfirmation,
  returnToList: () => {
    void navigate({ params: { contentTypeId }, to: "/content/$contentTypeId" });
  },
  save: mutations.save,
  saveValues,
  startPurge: () => {
    setConfirmPurge(true);
  },
  state,
  submitDeletion: () => {
    mutations.deleteEntry.mutate();
  },
  tags,
  title,
  titleField,
  updateField,
  values,
  };
}
