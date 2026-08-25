import type {
  DeletionRecord,
  EditorialConfirmationStatus,
  EntryConflict,
  createFieldUpdater,
  useEntryEditorControllerMutations,
  useEntryEditorQueries,
  useNavigate,
} from "./entry-editor-controller-view-imports.ts";

export interface EntryEditorControllerViewInput {
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
  readonly saveValues: <Values extends Record<string, unknown>>(
    replacementValues?: Readonly<Values>,
    writeToken?: string,
  ) => void;
  readonly setConfirmPurge: (value: boolean) => void;
  readonly setConflict: (value: EntryConflict | undefined) => void;
  readonly setDeletionDialogOpen: (value: boolean) => void;
  readonly setEditorialConfirmation: (value: EditorialConfirmationStatus | undefined) => void;
  readonly setValues: <Values extends Record<string, unknown>>(value: Readonly<Values>) => void;
  readonly state: ReturnType<typeof useEntryEditorQueries>["state"];
  readonly tags: ReturnType<typeof useEntryEditorQueries>["tags"];
  readonly title: string;
  readonly titleField: string;
  readonly updateField: ReturnType<typeof createFieldUpdater>;
  readonly values: Record<string, unknown>;
}
