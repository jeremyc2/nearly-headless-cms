import { DateTime, Effect } from "effect";
import { managementClient, queryClient } from "./main-shared.ts";
import { revisionClass, revisionLabel } from "./main-labels.ts";
import { useMutation, useQuery } from "@tanstack/react-query";
import { EntryEditorRevisionInspection } from "./entry-editor-revision-inspection.tsx";
import { useState } from "react";

interface EntryEditorRevisionSummary {
  readonly recordedAt: string;
  readonly revisionNumber: number;
}

const EntryEditorHistoryPanelBody = ({
    contentTypeId,
    entryId,
    writeToken,
  }: {
    readonly contentTypeId: string;
    readonly entryId: string;
    readonly writeToken?: string;
  }) => {
    const [selectedRevisionNumber, setSelectedRevisionNumber] = useState<number | undefined>(),
      restore = useEntryEditorRestoreMutation({
        contentTypeId,
        entryId,
        onRestored: () => {
          setSelectedRevisionNumber(undefined);
        },
        writeToken,
      }),
      revisions = useQuery({
        queryFn: () => Effect.runPromise(managementClient.listRevisions(contentTypeId, entryId)),
        queryKey: ["revisions", contentTypeId, entryId],
      });
    return (
      <EntryEditorHistoryPanelView
        contentTypeId={contentTypeId}
        entryId={entryId}
        restore={restore}
        revisions={revisions}
        selectedRevisionNumber={selectedRevisionNumber}
        setSelectedRevisionNumber={setSelectedRevisionNumber}
        writeToken={writeToken}
      />
    );
  },
  EntryEditorHistoryPanelView = <
    Restore extends ReturnType<typeof useEntryEditorRestoreMutation>,
    Revisions extends ReturnType<
      typeof useQuery<
        Awaited<ReturnType<typeof managementClient.listRevisions>>,
        Error,
        Awaited<ReturnType<typeof managementClient.listRevisions>>,
        readonly ["revisions", string, string]
      >
    >,
  >({
    contentTypeId,
    entryId,
    restore,
    revisions,
    selectedRevisionNumber,
    setSelectedRevisionNumber,
    writeToken,
  }: {
    readonly contentTypeId: string;
    readonly entryId: string;
    readonly restore: Readonly<Restore>;
    readonly revisions: Readonly<Revisions>;
    readonly selectedRevisionNumber: number | undefined;
    readonly setSelectedRevisionNumber: (revisionNumber: number | undefined) => void;
    readonly writeToken?: string;
  }) => (
    <section className="history-panel panel">
      <p className="eyebrow">History</p>
      <h2>Entry revisions</h2>
      {restore.error && (
        <p className="error-state" role="alert">
          {restore.error.message}
        </p>
      )}
      <EntryEditorRevisionList
        onSelectRevision={setSelectedRevisionNumber}
        revisions={entryEditorRevisionItems(revisions.data)}
      />
      <EntryEditorHistorySelectedRevision
        contentTypeId={contentTypeId}
        entryId={entryId}
        restore={restore}
        selectedRevisionNumber={selectedRevisionNumber}
        setSelectedRevisionNumber={setSelectedRevisionNumber}
        writeToken={writeToken}
      />
    </section>
  ),
  EntryEditorHistorySelectedRevision = <
    Restore extends ReturnType<typeof useEntryEditorRestoreMutation>,
  >({
    contentTypeId,
    entryId,
    restore,
    selectedRevisionNumber,
    setSelectedRevisionNumber,
    writeToken,
  }: {
    readonly contentTypeId: string;
    readonly entryId: string;
    readonly restore: Readonly<Restore>;
    readonly selectedRevisionNumber: number | undefined;
    readonly setSelectedRevisionNumber: (revisionNumber: number | undefined) => void;
    readonly writeToken?: string;
  }  ) =>
    selectedRevisionNumber !== undefined && (
      <EntryEditorRevisionInspection
        contentTypeId={contentTypeId}
        entryId={entryId}
        isRestoring={restore.isPending}
        onClose={() => {
          setSelectedRevisionNumber(undefined);
        }}
        onRestore={() => {
          restore.mutate(selectedRevisionNumber);
        }}
        restoreDisabled={writeToken === undefined}
        revisionNumber={selectedRevisionNumber}
      />
    ),
  EntryEditorRevisionList = ({
    onSelectRevision,
    revisions,
  }: {
    readonly onSelectRevision: (revisionNumber: number) => void;
    readonly revisions?: readonly EntryEditorRevisionSummary[];
  }) => (
    <>
      {revisions?.map((revision, index) => (
        <button
          className="revision-row"
          key={revision.revisionNumber}
          onClick={() => {
            onSelectRevision(revision.revisionNumber);
          }}
        >
          <span className={revisionClass(index)} />
          <span>
            <strong>Revision {revision.revisionNumber}</strong>
            <small>
              {revisionLabel(index)}
              {DateTime.toDate(DateTime.makeUnsafe(revision.recordedAt)).toLocaleString()}
            </small>
          </span>
        </button>
      ))}
    </>
  ),
  entryEditorRevisionItems = (
    revisions: { readonly items: readonly EntryEditorRevisionSummary[] } | undefined,
  ): readonly EntryEditorRevisionSummary[] | undefined => revisions?.items,
  useEntryEditorRestoreMutation = ({
    contentTypeId,
    entryId,
    onRestored,
    writeToken,
  }: {
    readonly contentTypeId: string;
    readonly entryId: string;
    readonly onRestored: () => void;
    readonly writeToken?: string;
  }) =>
    useMutation({
      mutationFn: (revisionNumber: number) => {
        if (writeToken === undefined) {
          throw new Error("Current Write Token is unavailable");
        }
        return Effect.runPromise(
          managementClient.restoreRevision({
            contentTypeId,
            entryId,
            revisionNumber,
            writeToken,
          }),
        );
      },
      // oxlint-disable-next-line effecttsgo/async-function -- React query callback awaits cache invalidation.
      onSuccess: async () => {
        onRestored();
        await queryClient.invalidateQueries({ queryKey: ["entry-state", contentTypeId, entryId] });
        await queryClient.invalidateQueries({ queryKey: ["revisions", contentTypeId, entryId] });
      },
    });

export { EntryEditorHistoryPanelBody as EntryEditorHistoryPanel };
