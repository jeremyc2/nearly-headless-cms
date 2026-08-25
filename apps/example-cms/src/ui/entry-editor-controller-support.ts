import { useEffect, useRef, useState } from "react";
import { createFieldUpdater, titleFieldFrom } from "./entry-editor-support.ts";
import { stringValue } from "./main-entry-support.ts";
import type {
  DeletionRecord,
  EditorialConfirmationStatus,
  EntryConflict,
} from "./entry-editor-types.ts";
import { useNavigate } from "@tanstack/react-router";
import entryEditorControllerMutationsSupport from "./entry-editor-controller-mutations.ts";
import entryEditorControllerViewSupport from "./entry-editor-controller-view.ts";
import { useEntryEditorQueries } from "./entry-editor-queries.ts";

const { useEntryEditorControllerMutations } = entryEditorControllerMutationsSupport,
  { useEntryEditorControllerView } = entryEditorControllerViewSupport,
  useEntryEditorController = () => {
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
      saveValues = (replacementValues = values, writeToken = state.data?.writeToken) => {
        mutations.save.mutate({ replacementValues, writeToken });
      },
      title = stringValue(values[titleFieldFrom(values)], ""),
      titleField = titleFieldFrom(values),
      updateField = createFieldUpdater(setValues);
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

export default {
  useEntryEditorController,
};
