# Make content-definition migrations explicit, atomic, and one-to-one

Definition changes that do not preserve persisted Entry representations require a Builder-registered, deterministic Migration Handler identified by an immutable serializable Manifest. The Catalog retains an unambiguous directed migration graph, while activation stages and validates a target Entry generation before one atomic cutover. This prevents the library from silently making lossy editorial choices and keeps code-first and UI-managed CMSs on the same durable lifecycle contract.
