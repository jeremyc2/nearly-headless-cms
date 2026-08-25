import entryEditorControllerViewSupport from "./entry-editor-controller-view-support.ts";
import type { useNavigate } from "@tanstack/react-router";
import type { useEntryEditorControllerMutations } from "./entry-editor-controller-mutations.ts";
import type { createFieldUpdater } from "./entry-editor-support.ts";
import type { useEntryEditorQueries } from "./entry-editor-queries.ts";
import type { DeletionRecord, EditorialConfirmationStatus, EntryConflict } from "./entry-editor-types.ts";

const { entryEditorControllerViewModel } = entryEditorControllerViewSupport,

 useEntryEditorControllerView = (input: {
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
}) => entryEditorControllerViewModel(input);

export default {
  useEntryEditorControllerView,
};
