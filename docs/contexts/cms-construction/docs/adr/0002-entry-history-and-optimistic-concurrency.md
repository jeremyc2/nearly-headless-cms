# Use opt-in retained Entry History with opaque optimistic-concurrency tokens

## Decision

Content Types opt into immutable retained Entry History. Complete Entry snapshots receive per-Entry Revision Numbers; deletion creates a retained Deletion Record, and restoration creates a new revision after validating current definitions and live references. History-enabled mutations require opaque Write Tokens, while ordinary Entry representations remain token-free. Deleted history remains restorable until Permanent Purge, subject to retention rules that retain at least the latest restorable snapshot.

## Consequences

- Builders can pay the storage and API complexity only for Content Types that need revision recovery and lost-update protection.
- Content Clients do not acquire accidental coupling to authoring concurrency details.
- Revisions are audit-like snapshots, not a frozen dependency graph: deleted references may make restoration fail.
- Persistence Layers need atomic transitions for the Entry state, revision history, token, deletion record, and retention pruning.

## Alternatives considered

- **Universal history and tokens**: simpler generic API, but imposes storage and authoring complexity on every Content Type.
- **Revision number as the concurrency condition**: exposes history structure as a write mechanism and cannot represent a deletion-state transition cleanly.
- **Deletion immediately removes history**: makes retention cheaper but gives no recovery path and defeats retained history at the point it is most useful.
