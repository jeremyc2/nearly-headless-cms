import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { stringValue } from "./main-entry-support.ts";
import {
  useEntryEditorDeleteMutation,
  useEntryEditorEditorialMutation,
  useEntryEditorPurgeMutation,
  useEntryEditorSaveMutation,
} from "./entry-editor-mutations.ts";
import { useEntryEditorQueries } from "./entry-editor-queries.ts";
import { createFieldUpdater, titleFieldFrom } from "./entry-editor-support.ts";
import type {
  DeletionRecord,
  EditorialConfirmationStatus,
  EntryConflict,
} from "./entry-editor-types.ts";

export const useEntryEditorController = () => {
  const navigate = useNavigate(),
    queries = useEntryEditorQueries(),
    { assets, authors, categories, contentTypeId, entryId, state, tags } = queries,
    loadedEntryIdentifier = useRef<string | null>(null),
    [confirmPurge, setConfirmPurge] = useState(false),
    [deletionDialogOpen, setDeletionDialogOpen] = useState(false),
    [conflict, setConflict] = useState<EntryConflict | undefined>(),
    [deletionRecord, setDeletionRecord] = useState<DeletionRecord | undefined>(),
    [editorialConfirmation, setEditorialConfirmation] = useState<
      EditorialConfirmationStatus | undefined
    >(),
    [values, setValues] = useState<Record<string, unknown>>({}),
    deleteEntry = useEntryEditorDeleteMutation({
      contentTypeId,
      entryId,
      onDeleted: (receipt) => {
        setDeletionDialogOpen(false);
        setDeletionRecord(receipt);
      },
      writeToken: state.data?.writeToken,
    }),
    editorialCommand = useEntryEditorEditorialMutation({
      contentTypeId,
      entryId,
      onUpdated: (updatedValues) => {
        setValues(structuredClone(updatedValues));
      },
      writeToken: state.data?.writeToken,
    }),
    permanentlyPurge = useEntryEditorPurgeMutation({ contentTypeId, deletionRecord }),
    save = useEntryEditorSaveMutation({
      contentTypeId,
      entryId,
      onConflict: (latest) => {
        setConflict({ latest });
      },
      onSaved: (savedValues) => {
        setValues(structuredClone(savedValues));
        setConflict(undefined);
      },
    }),
    title = stringValue(values[titleFieldFrom(values)], ""),
    titleField = titleFieldFrom(values),
    updateField = createFieldUpdater(setValues),
    saveValues = (replacementValues = values, writeToken = state.data?.writeToken) => {
      save.mutate({ replacementValues, writeToken });
    };
  useEffect(() => {
    if (state.data !== undefined && loadedEntryIdentifier.current !== entryId) {
      loadedEntryIdentifier.current = entryId;
      setValues(structuredClone(state.data.entry.values));
      setConflict(undefined);
    }
  }, [entryId, state.data]);
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
      editorialCommand.mutate(status);
      setEditorialConfirmation(undefined);
    },
    confirmPurge,
    confirmPurgeAction: () => {
      permanentlyPurge.mutate();
    },
    conflict,
    contentTypeId,
    deleteEntry,
    deletionDialogOpen,
    deletionRecord,
    discardConflict: (latestValues: Record<string, unknown>) => {
      setValues(structuredClone(latestValues));
      setConflict(undefined);
    },
    editorialCommand,
    editorialConfirmation,
    entryId,
    permanentlyPurge,
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
    save,
    saveValues,
    startPurge: () => {
      setConfirmPurge(true);
    },
    state,
    submitDeletion: () => {
      deleteEntry.mutate();
    },
    tags,
    title,
    titleField,
    updateField,
    values,
  };
};
