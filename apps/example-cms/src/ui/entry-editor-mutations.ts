import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Effect, Schema } from "effect";
import { ManagementClientFailure } from "../generated/management-client.ts";
import type { EntryRepresentation } from "../generated/management-client.ts";
import { deletionRecordFrom } from "./main-entry-support.ts";
import {
  normalizeSaveResult,
} from "./entry-editor-support.ts";
import type { DeletionRecord } from "./entry-editor-types.ts";
import { managementClient, queryClient } from "./main-shared.ts";

export const useEntryEditorSaveMutation = ({
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
        managementClient.replaceEntry({
          contentTypeId,
          entryId,
          values: replacementValues,
          writeToken,
        }),
      ),
    // oxlint-disable-next-line effecttsgo/async-function -- React query error callback awaits the latest server state.
    onError: async (error) => {
      if (Schema.is(ManagementClientFailure)(error) && error.status === 409) {
        const latest = await Effect.runPromise(
          managementClient.getCurrentState(contentTypeId, entryId),
        );
        onConflict(latest);
      }
    },
    onSuccess: (result) => {
      const updatedState = normalizeSaveResult(result);
      onSaved(updatedState.entry.values);
      return queryClient
        .invalidateQueries({ queryKey: ["entry-state", contentTypeId, entryId] })
        .then(() => queryClient.invalidateQueries({ queryKey: ["entries", contentTypeId] }))
        .then(() => queryClient.invalidateQueries({ queryKey: ["count", contentTypeId] }));
    },
  });

export const useEntryEditorEditorialMutation = ({
  contentTypeId,
  entryId,
  onUpdated,
  writeToken,
}: {
  readonly contentTypeId: string;
  readonly entryId: string;
  readonly onUpdated: (values: Record<string, unknown>) => void;
  readonly writeToken?: string;
}) =>
  useMutation({
    mutationFn: (status: "approved" | "draft" | "published" | "rejected") => {
      if (writeToken === undefined || (contentTypeId !== "comment" && contentTypeId !== "post")) {
        throw new Error("Current Entry state is unavailable");
      }
      return Effect.runPromise(
        managementClient.runEditorialCommand({
          contentTypeId,
          entryId,
          status,
          writeToken,
        }),
      );
    },
    onSuccess: (result) => {
      onUpdated(result.entry.values);
      return queryClient
        .invalidateQueries({ queryKey: ["entry-state", contentTypeId, entryId] })
        .then(() => queryClient.invalidateQueries({ queryKey: ["entries", contentTypeId] }))
        .then(() => queryClient.invalidateQueries({ queryKey: ["revisions", contentTypeId, entryId] }));
    },
  });

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
          managementClient.deleteContentEntry(contentTypeId, entryId, writeToken),
        ),
        receipt = deletionRecordFrom(outcome);
      if (receipt === undefined) {
        throw new Error("The deletion did not return a retained deletion record");
      }
      return receipt;
    },
    onSuccess: (receipt) => {
      onDeleted(receipt);
      return queryClient
        .invalidateQueries({ queryKey: ["entries", contentTypeId] })
        .then(() => queryClient.invalidateQueries({ queryKey: ["count", contentTypeId] }))
        .then(() => queryClient.invalidateQueries({ queryKey: ["navigation"] }));
    },
  });

export const useEntryEditorPurgeMutation = ({
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
        managementClient.permanentlyPurgeEntry(
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
};
