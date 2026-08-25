import * as mainShared from "./main-shared.ts";
import { Effect, Schema } from "effect";
import { type EntryRepresentation, ManagementClientFailure } from "../generated/management-client.ts";
import type { DeletionRecord } from "./entry-editor-types.ts";
import { deletionRecordFrom } from "./main-entry-support.ts";
import { httpStatusConflict } from "nearly-headless-cms/http";
import { normalizeSaveResult } from "./entry-editor-support.ts";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

export const useEntryEditorDeleteMutation = ({
  contentTypeId,
  entryId,
  onDeleted,
  writeToken,
}: {
  readonly contentTypeId: string;
  readonly entryId: string;
  readonly onDeleted: (receipt: DeletionRecord) => void;
  readonly writeToken?: string;
}) =>
  useMutation({
    // oxlint-disable-next-line effecttsgo/async-function -- deletion sequence requires awaited server state.
    mutationFn: async () => {
      if (
        writeToken === undefined ||
        (contentTypeId !== "author" &&
          contentTypeId !== "category" &&
          contentTypeId !== "comment" &&
          contentTypeId !== "post" &&
          contentTypeId !== "tag")
      ) {
        throw new Error("Current Entry deletion state is unavailable");
      }
      const outcome = await Effect.runPromise(
          mainShared.managementClient.deleteContentEntry(contentTypeId, entryId, writeToken),
        ),
        receipt = deletionRecordFrom(outcome);
      if (receipt === undefined) {
        throw new Error("The deletion did not return a retained deletion record");
      }
      return receipt;
    },
    onSuccess: (receipt) => {
      onDeleted(receipt);
      return mainShared.queryClient
        .invalidateQueries({ queryKey: ["entries", contentTypeId] })
        .then(() => mainShared.queryClient.invalidateQueries({ queryKey: ["count", contentTypeId] }))
        .then(() => mainShared.queryClient.invalidateQueries({ queryKey: ["navigation"] }));
    },
  }),

useEntryEditorEditorialMutation = ({
  contentTypeId,
  entryId,
  onUpdated,
  writeToken,
}: {
  readonly contentTypeId: string;
  readonly entryId: string;
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- React callbacks receive mutable draft value maps from the editor.
  readonly onUpdated: (values: Record<string, unknown>) => void;
  readonly writeToken?: string;
}) =>
  useMutation({
    mutationFn: (status: "approved" | "draft" | "published" | "rejected") => {
      if (writeToken === undefined || (contentTypeId !== "comment" && contentTypeId !== "post")) {
        throw new Error("Current Entry state is unavailable");
      }
      return Effect.runPromise(
        mainShared.managementClient.runEditorialCommand({
          contentTypeId,
          entryId,
          status,
          writeToken,
        }),
      );
    },
    onSuccess: (result) => {
      onUpdated(result.entry.values);
      return mainShared.queryClient
        .invalidateQueries({ queryKey: ["entry-state", contentTypeId, entryId] })
        .then(() => mainShared.queryClient.invalidateQueries({ queryKey: ["entries", contentTypeId] }))
        .then(() => mainShared.queryClient.invalidateQueries({ queryKey: ["revisions", contentTypeId, entryId] }));
    },
  }),

useEntryEditorPurgeMutation = ({
  contentTypeId,
  deletionRecord,
}: {
  readonly contentTypeId: string;
  readonly deletionRecord?: DeletionRecord;
}) => {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: () => {
      if (deletionRecord === undefined) {
        throw new Error("Deletion record is unavailable");
      }
      return Effect.runPromise(
        mainShared.managementClient.permanentlyPurgeEntry(
          deletionRecord.contentTypeId,
          deletionRecord.entryId,
          deletionRecord.writeToken,
        ),
      );
    },
    // oxlint-disable-next-line effecttsgo/async-function -- React query callback awaits navigation.
    onSuccess: async () => {
      await navigate({ params: { contentTypeId }, to: "/content/$contentTypeId" });
    },
  });
},

useEntryEditorSaveMutation = ({
  contentTypeId,
  entryId,
  onConflict,
  onSaved,
}: {
  readonly contentTypeId: string;
  readonly entryId: string;
  readonly onConflict: (latest: {
    readonly entry: EntryRepresentation;
    readonly revisionNumber: number;
    readonly writeToken: string;
  }) => void;
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- React callbacks receive mutable draft value maps from the editor.
  readonly onSaved: (values: Record<string, unknown>) => void;
}) =>
  useMutation({
    mutationFn: ({
      replacementValues,
      writeToken,
    }: {
      readonly replacementValues: Readonly<Record<string, unknown>>;
      readonly writeToken?: string;
    }) =>
      Effect.runPromise(
        mainShared.managementClient.replaceEntry({
          contentTypeId,
          entryId,
          values: replacementValues,
          writeToken,
        }),
      ),
    // oxlint-disable-next-line effecttsgo/async-function -- React query error callback awaits the latest server state.
    onError: async (error) => {
      if (Schema.is(ManagementClientFailure)(error) && error.status === httpStatusConflict) {
        const latest = await Effect.runPromise(
          mainShared.managementClient.getCurrentState(contentTypeId, entryId),
        );
        onConflict(latest);
      }
    },
    onSuccess: (result) => {
      const updatedState = normalizeSaveResult(result);
      onSaved(updatedState.entry.values);
      return mainShared.queryClient
        .invalidateQueries({ queryKey: ["entry-state", contentTypeId, entryId] })
        .then(() => mainShared.queryClient.invalidateQueries({ queryKey: ["entries", contentTypeId] }))
        .then(() => mainShared.queryClient.invalidateQueries({ queryKey: ["count", contentTypeId] }));
    },
  });
