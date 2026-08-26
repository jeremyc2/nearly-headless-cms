import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import { Effect } from "effect";
import type { Revision } from "../generated/management-openapi-client-component-types.ts";
import { managementClient } from "./main-shared.ts";

const EntryEditorRevisionInspection = ({
    contentTypeId,
    entryId,
    isRestoring,
    onClose,
    onRestore,
    restoreDisabled,
    revisionNumber,
  }: {
    readonly contentTypeId: string;
    readonly entryId: string;
    readonly isRestoring: boolean;
    readonly onClose: () => void;
    readonly onRestore: () => void;
    readonly restoreDisabled: boolean;
    readonly revisionNumber: number;
  }) => {
    const inspectedRevision = useQuery({
      enabled: true,
      queryFn: () =>
        Effect.runPromise(managementClient.inspectRevision(contentTypeId, entryId, revisionNumber)),
      queryKey: ["revision", contentTypeId, entryId, revisionNumber],
    });
    return (
      <div aria-modal="true" className="revision-inspection" role="dialog">
        <EntryEditorRevisionInspectionCard
          inspectedRevision={inspectedRevision}
          isRestoring={isRestoring}
          onClose={onClose}
          onRestore={onRestore}
          restoreDisabled={restoreDisabled}
          revisionNumber={revisionNumber}
        />
      </div>
    );
  },
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-266] React Query results expose mutable status fields while rendering revision details.
  EntryEditorRevisionInspectionCard = ({
    inspectedRevision,
    isRestoring,
    onClose,
    onRestore,
    restoreDisabled,
    revisionNumber,
  }: {
    readonly inspectedRevision: UseQueryResult<Revision>;
    readonly isRestoring: boolean;
    readonly onClose: () => void;
    readonly onRestore: () => void;
    readonly restoreDisabled: boolean;
    readonly revisionNumber: number;
  }) => (
    <div className="revision-inspection-card">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Complete captured values</p>
          <h2>Revision {revisionNumber}</h2>
        </div>
        <button className="secondary-button" onClick={onClose} type="button">
          Close
        </button>
      </div>
      {inspectedRevision.isLoading && <p>Loading revision…</p>}
      {!inspectedRevision.isLoading && (
        <pre>{JSON.stringify(inspectedRevision.data?.values, null, jsonPreviewIndent)}</pre>
      )}
      <button
        className="primary-button"
        disabled={isRestoring || restoreDisabled}
        onClick={onRestore}
        type="button"
      >
        Restore as a new revision
      </button>
    </div>
  ),
  jsonPreviewIndent = 2;

export { EntryEditorRevisionInspection };
