# Content-Definition Migration Semantics

## Decision

Content Definitions evolve through immutable Definition Revisions and complete Definition Snapshots. The library classifies only representation-preserving metadata edits and additions of Optional Fields as Compatible Definition Changes. Adding a required Field, even with a Default Value, requires a migration because defaults apply only at Entry creation. Field Key or Field Kind changes, removals, constraint tightening, Relationship target changes, Field Group composition changes, and Custom Field Kind format changes require an explicit Migration Step.

A Migration Step is a CMS Builder-supplied, versioned, deterministic, side-effect-free, one-to-one transformation of one current Entry into one Entry with the same Entry ID and Content Type. It receives only its source values and immutable Migration Manifest metadata. Its serializable Manifest names exact source and target Definition Snapshots plus its stable handler identifier and version; its executable Migration Handler is registered by the Builder rather than stored in the Definition Catalog. The result must completely validate under the target Snapshot. The library never retains an undeclared legacy-value bag: a migration explicitly drops, transforms, or moves affected values into valid target Fields.

Activation prepares target Entry values in a separate generation, validates the complete target Definition Space and its Relationships, and records the source generation. Normal reads and writes continue during preparation. A concurrent source write makes preparation stale; cutover must re-prepare before it can succeed. The brief Atomic Definition Cutover commits the active Definition Snapshot and prepared Entries together, so operations observe either the source state or target state. Handler absence, transformation failure, validation failure, or a stale preparation returns a typed Migration Failure Report and changes neither current Entries nor the active Snapshot.

The Definition Catalog is append-only. It retains Definition Revisions, Snapshots, Migration Manifests, compatible identity edges, and completed preparation records indefinitely. A Compatible Definition Change records an immutable library-generated identity edge, allowing one uniform migration-path model. Registered edges form a directed graph with at most one path between any two Snapshots; a Manifest that would create an ambiguous path is rejected. An activation from the active Snapshot uses one direct explicit step (or a compatible identity edge). Restoring an immutable Entry Revision uses the unique directed Migration Path from the Revision's captured Definition Snapshot to the active Snapshot, validates current live dependencies, then creates a new Entry Revision. If no path exists, restoration fails. Rollback is a forward migration from the current Snapshot to an earlier target and needs its own explicit step; reversibility is never assumed.

Generic migrations do not create or delete Entries, move an Entry to another Content Type, or coordinate multiple Entries. Builders needing those operations supply explicit maintenance commands outside the generic Definition Lifecycle.

## Consequences

- Code-first and UI-managed Headless CMSs share portable, auditable Catalog records without serializing executable code.
- Entry History remains immutable and distinct from current data migration; old revisions can legitimately become unrestorable when no valid path remains.
- Persistence Layers must support staging, source-generation comparison, and one atomic Entry-generation plus Definition-Registry cutover.
- Cross-Entry reshaping is intentionally not portable v0.1 behavior.
