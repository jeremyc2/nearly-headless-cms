# Entry History and Optimistic-Concurrency Semantics

## Decision

A Content Type opts into Entry History explicitly. A Content Type without Entry History retains the five ordinary generic Entry operations—create, get, update, delete, and query—with no required Write Token and no history operations.

For a history-enabled Content Type, create writes Entry Revision 1. Every successful complete-replacement update writes the next immutable, complete Entry Revision. Restoring an earlier revision validates that snapshot against the active Content Definition and live Asset and Relationship targets, then writes a new next Entry Revision; the resulting revision records its source Revision Number. A failed validation, missing target, or Write Token mismatch writes nothing.

An Entry Revision has a per-Entry monotonically increasing Revision Number and library-owned UTC recording time as history metadata. Revision numbers identify complete snapshots only: deleting an Entry writes a Deletion Record referencing its latest revision without consuming a Revision Number, and a later restore writes the next number. Revisions are listed newest-first through cursor pagination; a list contains history metadata, while inspection of one revision returns its complete captured values.

For a history-enabled Entry, ordinary get and query return the existing projection-friendly Entry Representation and never expose a Write Token or a deleted Entry. A separate history-aware current-state read returns the complete Entry and its opaque current Write Token. Successful create, update, and restore return that Current Entry State. Delete returns a Deletion Record state with the next Write Token, which is required by a subsequent restore or Permanent Purge.

Update, delete, restore, and Permanent Purge require the current Write Token. A mismatch returns Conflict without writing. Write Tokens are distinct from Revision Numbers and are not timestamps, ETags, or values available from ordinary projections. All generic history operations—list and inspect history, restore, and Permanent Purge—are distinct library-defined Actions authorized once against the minimal Entry Resource before the service looks up the Entry or its history.

Deleting a history-enabled Entry makes it absent from ordinary get and query while retaining its Entry History. Permanent Purge is permitted only for a deleted Entry and irreversibly removes the Entry, its Deletion Record, and all retained Entry Revisions. Retained historical Asset and Relationship IDs do not prevent their targets from being deleted; revision inspection shows those captured IDs, and restoration revalidates that the targets remain live.

History is retained indefinitely unless the Content Type declares a Revision Retention Policy with a maximum revision count, maximum age, or both. The persistence Layer prunes eligible old revisions atomically as part of a create, update, restore, or delete that exceeds this policy. Pruning neither creates a revision nor changes a Write Token by itself. It never removes the current revision, the latest Deletion Record, or the newest Entry Revision retained alongside a Deletion Record, so every deleted Entry remains restorable until Permanent Purge. A requested revision already pruned by retention is NotFound.

Definition migrations may change current Entries and future restorability, but they do not rewrite immutable Entry Revisions. The detailed migration commit and rollback behavior remains the concern of the content-definition migration decision.

## Consequences

- History is an intentional Content Type capability, not an unavoidable storage or API cost.
- Content Clients remain independent of authoring concurrency mechanics because ordinary Entry Representations and projections carry no Write Token.
- Restoring old content cannot bypass the currently active Content Definition or referential-integrity guarantees.
- Storage implementations must atomically commit the current state, any new revision or Deletion Record, Write Token transition, and retention pruning in one mutation generation.
- Long-lived historical snapshots do not retain deleted Assets or Entries indefinitely, so restore can legitimately fail when a dependency has been removed.
