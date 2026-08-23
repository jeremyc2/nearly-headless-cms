# Fields, Field Groups, and Custom Field Kinds

## Decision

Content Definitions and Entry values are serializable data. Content Types and Field Groups have immutable URL-safe lowercase identifiers, independent of editable names. Each Field has an immutable, locally unique Field Key that is the persisted object key; renaming it is a migration.

The library supplies portable Field Kinds for constrained scalars (`text`, JSON-safe `integer`, finite `number`, `boolean`, `date`, `datetime`, `url`, `email`, and enumerated string), JSON, Asset, Relationship, Rich Text, and List. A `date` is an ISO-8601 calendar date. A `datetime` is a normalized UTC ISO-8601 instant. The specialized semantics for Rich Text and Relationship lifecycle behavior remain owned by their dependent decisions.

Validation is declarative. Fields may be required, nullable, have a validated creation-only default, and apply kind-appropriate length, range, pattern, enum, and single-field uniqueness constraints. The library validates but never coerces or normalizes a value. A generic update is the complete replacement defined by the later Entry Operations decision; partial changes require a separately named CMS Builder command. A unique constraint applies only to one non-null scalar Field or nested scalar Field path, and every Entry persistence adapter enforces it atomically among live Entries of that Content Type.

Field Groups are reusable schema fragments, not CMS UI layout. They compose into Content Types and other Field Groups in explicit modes: `nested` mounts an object under a new Field Key, and `inline` merges Fields while rejecting collisions. The active Definition Snapshot rejects every Field Group inclusion cycle. A List Field stores an ordered sequence whose element is one Field or Field Group; it may constrain length but has no library-defined item identifier, editor behavior, or item-level filtering.

An Asset Field stores one Asset ID or a list of Asset IDs. A Relationship Field stores one Entry ID or a list of Entry IDs and declares its allowed target Content Type IDs. They never copy target data. Read expansion and target-deletion semantics are separate concerns.

A JSON Field accepts any JSON-compatible value but has no portable filter, sort, uniqueness, or schema constraint. JSON-compatible persisted values consist only of JSON values; Custom Field Kinds validate that stored form even if application code converts it for local use.

The library reserves short Field Kind names. A CMS Builder uses a reverse-domain Custom Field Kind identifier and integer format version, for example `com.example.rating` version `1`. At CMS composition time, the builder registers deterministic configuration and value validators plus the Field Kind's supported generic-operation capabilities. Content Definitions reference this registered contract; they never contain executable code. Activation atomically fails when a definition uses an unknown or unsupported Custom Field Kind version, preserving the current Definition Snapshot.

## Deferred decisions

- The portable query algebra and the exact meaning of declared generic-operation capabilities are defined by issue #2.
- Relationship expansion and referential-integrity behavior are defined by issue #11.
- Rich Text's document shape and extensions are defined by issue #17.
- Entry and Content Definition migration behavior are defined by issues #16 and #10.
