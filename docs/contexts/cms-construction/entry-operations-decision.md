# Generic Entry Operations and Portable Query Model

## Decision

The library guarantees five generic operations, each scoped to exactly one Content Type: create, get, update, delete, and query. `get` is the ID lookup convenience. Create and update validate a complete replacement of an Entry's Field values; creation applies declared defaults only to absent Fields, while an update never materializes a default for an already persisted Entry. Create and update return the newly persisted complete Entry Representation. Delete returns successful completion only. Get, update, and delete of an absent Entry return `NotFound`; a query with no matches returns an empty Query Page.

An Entry Representation contains an immutable generated Entry ID, its Content Type identifier, and selected Field values. It has no library-defined created or updated timestamp, publication metadata, Entry Revision, or write token. Builder-defined Fields own editorial semantics, including status and publication dates.

An Entry Query selects Entries of one Content Type through a portable algebra:

- Field-path predicates: `equals`, `notEquals`, `in`, `notIn`, ordered comparison, string prefix, string containment, and null-or-missing checks.
- Recursive boolean groups: `all`, `any`, and `not`.
- One or more scalar Field-path sort keys and directions, with Entry ID always the final deterministic tie-breaker.
- Opaque cursor pagination, never offset pagination.
- Explicit Field-path Projection and an optional bounded Relationship Expansion plan.

Every predicate, sort, and projection capability is explicitly declared by the relevant Field Kind. Built-in string matching is case-sensitive Unicode code-point equality, prefix, and containment; it excludes locale collation, case folding, tokenization, and full-text search. Sorting puts missing and null values last in either direction. A Relationship Field may be filtered by its stored target Entry ID, but a query cannot traverse into related Entries. A Field Path may traverse nested Field Group objects only; List items, JSON, Rich Text, and Custom Field values are indivisible unless their Field Kind explicitly declares the requested capability.

A Query Page is internally consistent when evaluated. Its cursor is a best-effort continuation after subsequent writes: an invalid or stale cursor returns a typed conflict and never silently restarts. Pages return selected Entries and a next cursor when more results may exist; they do not contain an exact total count.

The CMS configures Query Limits for page size, Projection, and Relationship Expansion complexity. The request must specify a positive page size no greater than the configured maximum. Unknown or invalid paths, operators, sort keys, and cursors, or requests that exceed Query Limits, return `InvalidInput`.

An Entry persistence implementation may perform a bounded scan when it preserves the specified semantics. It exposes its Query Capabilities and returns `UnsupportedQueryCapability` when it cannot correctly fulfil a requested operation, or when an explicit resource limit prevents it. It must never approximate a result.

## Deferred decisions

- Entry History retention, restoration, and optimistic-concurrency Write Tokens are defined by `entry-history-decision.md`.
- The wire representation of commands, queries, errors, and cursors is defined by issue #9.
- Filesystem persistence indexes, scanning limits, atomicity, and failure behavior are defined by `filesystem-persistence-decision.md`.
- The Example CMS's specific list views and filters are defined by its application and prototype decisions.
