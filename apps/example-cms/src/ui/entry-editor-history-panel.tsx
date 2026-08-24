import { DateTime, Effect } from "effect";
import { managementClient, queryClient } from "./main-shared.ts";
import { revisionClass, revisionLabel } from "./main-labels.ts";
import { useMutation, useQuery } from "@tanstack/react-query";
import { EntryEditorRevisionInspection } from "./entry-editor-revision-inspection.tsx";
import { useState } from "react";

export const EntryEditorHistoryPanel = ({
  contentTypeId,
  entryId,
  writeToken,
}: {
  readonly contentTypeId: string;
  readonly entryId: string;
  readonly writeToken?: string;
}) => {
  const [selectedRevisionNumber, setSelectedRevisionNumber] = useState<number | undefined>(),
    restore = useMutation({
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
        setSelectedRevisionNumber(undefined);
        await queryClient.invalidateQueries({ queryKey: ["entry-state", contentTypeId, entryId] });
        await queryClient.invalidateQueries({ queryKey: ["revisions", contentTypeId, entryId] });
      },
    }),
    revisions = useQuery({
      queryFn: () => Effect.runPromise(managementClient.listRevisions(contentTypeId, entryId)),
      queryKey: ["revisions", contentTypeId, entryId],
    });
  return (
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
        revisions={revisions.data?.items}
      />
      {selectedRevisionNumber !== undefined && (
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
      )}
    </section>
  );
},

EntryEditorRevisionList = ({
  onSelectRevision,
  revisions,
}: {
  readonly onSelectRevision: (revisionNumber: number) => void;
  readonly revisions?: readonly { readonly recordedAt: string; readonly revisionNumber: number }[];
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
);
