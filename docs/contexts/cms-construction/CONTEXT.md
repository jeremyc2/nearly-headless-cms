# CMS Construction

CMS Construction is the language of the reusable library for defining and operating a headless CMS while leaving infrastructure, user interface, and presentation choices to its builder.

## Language

**CMS Builder**:
A developer who uses the Nearly Headless CMS library to assemble a CMS with their chosen user interface and integrations.
_Avoid_: Package consumer, integrator

**Rich Text**:
Structured content that preserves document structure and semantic marks such as emphasis and strong emphasis without prescribing their visual presentation.
_Avoid_: Styled text, HTML blob

**System**:
One independently composed part of the headless content flow: the reusable library, a Headless CMS built with it, or a Content Client that consumes that CMS.
_Avoid_: Architectural layer, tier

**Headless CMS**:
A system assembled by a CMS Builder from the library, CMS-specific behavior, a user interface, and Effect Layers that provide its external capabilities.
_Avoid_: Nearly Headless CMS library

**Content Client**:
A system that consumes content from a Headless CMS and owns how that content is presented.
_Avoid_: CMS UI, frontend layer

**Headless API**:
The public transport boundary through which a Content Client consumes content from a Headless CMS without importing its implementation or the reusable library.
_Avoid_: SDK, direct CMS dependency

**Current Identity**:
The request-scoped identity context supplied by a CMS Builder. It is either an opaque builder-defined Actor or the explicit Anonymous state; it is not a library User model.
_Avoid_: Logged-in user, session user

**Actor**:
An opaque identity defined by a CMS Builder and carried through the Current Identity context. Its attributes, authentication method, and lifecycle belong to the builder.
_Avoid_: User, account, principal

**Anonymous**:
The explicit Current Identity state for a request without an Actor.
_Avoid_: Missing identity, unauthenticated error

**Authorization**:
The CMS Builder-supplied policy boundary that returns allow or forbid for one library-defined Action on a minimal Resource descriptor in the context of a Current Identity. Every public generic CMS operation invokes it once before validation or persistence; a denial returns `Forbidden` without first checking resource existence, and it has no built-in trusted bypass. It does not rewrite queries, redact values, impose rate limits, create audit records, or encode editorial workflow.
_Avoid_: Query scoping, field permissions

**Open-access CMS**:
A Headless CMS whose Current Identity is always Anonymous and whose Authorization allows every generic CMS Action. The Example CMS is an Open-access CMS and provides no user-management implementation.
_Avoid_: Unsecured CMS, authenticated CMS

**Action**:
A library-defined, typed generic CMS operation submitted to Authorization. The closed vocabulary covers definition lifecycle, Entry and Asset reads and mutations, and transport-facing public reads; CMS Builder-specific commands are outside it.
_Avoid_: Role, permission string

**Resource**:
The minimal library-defined descriptor naming the subject of an Action, such as a Definition Space, Content Type, Entry, or Asset. It contains no builder-specific authorization attributes.
_Avoid_: Full Entry, policy context

**Content Type**:
A named schema that defines the Fields accepted by one kind of content.
_Avoid_: Collection, schema type

**Entry**:
One persisted value conforming to a Content Type.
_Avoid_: Document, item, record

**Field**:
One named, typed part of an Entry's Content Type or Field Group. Its immutable Field Key is the persisted object key; its editable label and description are human-readable metadata.
_Avoid_: Property, attribute

**Field Key**:
The URL-safe lowercase identifier for a Field, unique within its containing Content Type or Field Group. Changing a Field Key is a content migration, not a label edit.
_Avoid_: Field label, display name

**Field Kind**:
A serializable, versioned description of a Field's value shape and portable operations. Built-in Field Kinds are portable; a Custom Field Kind must declare its own validation and supported generic capabilities.
_Avoid_: Widget, input control

**Custom Field Kind**:
A CMS Builder-defined Field Kind with a stable kind identifier, format version, JSON-compatible configuration, deterministic value validation, and explicit generic-operation capabilities. Its CMS Builder registers those validators when composing the Headless CMS; it does not define presentation for the reusable library.
_Avoid_: Custom widget, UI extension

**Built-in Field Kind**:
One portable Field Kind supplied by the reusable library: constrained scalar, structured JSON, Asset, Relationship, or Rich Text. Asset, Relationship, and Rich Text share the Field boundary while their specialized value semantics are defined independently.
_Avoid_: UI control, status field

**Field Constraint**:
A declarative restriction on a Field value, such as requiredness, nullability, a default, length, range, pattern, enumerated values, or uniqueness. Constraints describe content validity rather than how a CMS UI displays the Field; the library validates values without silently converting them.
_Avoid_: Form validation rule, widget setting

**Default Value**:
A value that the CMS uses only when it creates an Entry and its Field is absent. Reading, updating, or activating a Content Definition does not add a Default Value to an existing Entry.
_Avoid_: Implied stored value

**Optional Field**:
A Field that an Entry may omit. A required Field must be present with a non-null value, while a nullable Field independently permits an explicit null value.
_Avoid_: Unvalidated Field

**Unique Field**:
A non-null scalar Field, or nested scalar Field path, whose value occurs at most once among live Entries of one Content Type. Entry persistence enforces it atomically; composite, array, and case-insensitive uniqueness are outside v0.1.
_Avoid_: Database index

## Entry operations

**Entry Query**:
A declarative request to select Entries of exactly one Content Type using supported Field-path predicates, recursive boolean composition, sorting, cursor pagination, projection, and optional Relationship Expansion.
_Avoid_: Database query, search request

**Query Capability**:
One filtering, sorting, projection, pagination, or expansion behavior that a Field Kind or Entry persistence implementation explicitly supports. A request needing an unavailable capability fails rather than producing an approximate result.
_Avoid_: Best-effort query, implicit fallback

**Cursor**:
An opaque continuation value for a deterministically sorted Entry Query. Its order is made stable by Entry ID as the final tie-breaker.
_Avoid_: Offset, page number

**Projection**:
The explicit set of Entry Field paths requested by an Entry Query or read. Unselected Fields are absent from the returned representation, while Entry identity and Content Type remain present.
_Avoid_: Redaction, null-filled response

**Query Page**:
One internally consistent evaluation of an Entry Query that returns selected Entries and, when more results may exist, a next Cursor. It does not promise a snapshot across later pages after concurrent writes.
_Avoid_: Stable result set, counted page

**Unsupported Query Capability**:
A typed failure reporting that an Entry Query needs a capability absent from the relevant Field Kind or persistence implementation. It never permits approximate filtering, sorting, or expansion.
_Avoid_: Slow-query error, fallback result

**Field Path**:
A dot-separated route through nested Field Group objects to one Field. It cannot address an individual List item or descend into JSON, Rich Text, or a Custom Field Kind unless that Field Kind explicitly supports the requested capability.
_Avoid_: JSONPath, relation traversal

**Portable Text Matching**:
Case-sensitive Unicode-code-point equality, prefix, and containment behavior for built-in string Fields. It excludes locale collation, case folding, tokenization, and full-text search.
_Avoid_: Search, linguistic matching

**Query Limit**:
A CMS-configured bound applied to an Entry Query's requested page size and its projection and Relationship Expansion complexity. An over-limit request is Invalid Input rather than a partial result.
_Avoid_: Advisory limit, best-effort truncation

**Entry Representation**:
The returned form of an Entry: its immutable generated Entry ID, Content Type identifier, and selected Field values. It carries no library-defined editorial timestamp, publication metadata, Entry Revision, or write token.
_Avoid_: Document envelope, audit record

**Asset Field**:
A Field whose value is one Asset ID or a list of Asset IDs. It references immutable Assets instead of embedding their content in an Entry.
_Avoid_: File upload control, embedded file

**Relationship Field**:
A Field whose value is one Entry ID or an ordered list of distinct Entry IDs, constrained to one or more declared target Content Types in the same Definition Space. It may target its own Content Type and participate in a cycle; its cardinality and optionality follow the ordinary Field and List Field rules.
_Avoid_: Embedded Entry, foreign-key implementation

**Referential Integrity**:
The guarantee that every non-null Relationship Field value names an existing Entry of one of its declared target Content Types, checked atomically with a source Entry write. A target Entry cannot be deleted while any Relationship Field references it.
_Avoid_: Best-effort reference validation, cascading delete

**Relationship Expansion**:
The caller-requested read-time replacement of a Relationship Field's Entry IDs with Entry representations. It is a separately authorized generic read action, never implicit, and is bounded and cycle-safe without per-target filtering or redaction.
_Avoid_: Eager loading, embedded Entry

**Reference-Blocked Deletion**:
The generic deletion failure returned when an Entry still has inbound Relationship references. It does not disclose the source Entry IDs or Field paths that block deletion.
_Avoid_: Cascade failure detail, reference leak

**List Field**:
A Field whose value is an ordered list of values, each validated by one declared element Field or Field Group. It may constrain list length but does not give items library-defined identities, an ordering interface, or item-level generic filtering.
_Avoid_: Repeating form control

**JSON Field**:
A Field that accepts any JSON-compatible value without portable filtering, sorting, uniqueness, or schema constraints. A CMS Builder uses a Custom Field Kind when that value needs a typed contract.
_Avoid_: Untyped custom Field

**JSON-compatible Value**:
A persisted Entry value made only of null, boolean, finite number, string, array, and object values that JSON can represent. A Custom Field Kind validates this stored form even when application code converts it to another representation.
_Avoid_: Runtime object, serialized program

**Date Field**:
A Field whose value is an ISO-8601 calendar date without a time or time zone.
_Avoid_: Timestamp

**Datetime Field**:
A Field whose value is a normalized UTC ISO-8601 instant.
_Avoid_: Calendar date

**Field Kind Identifier**:
The stable name of a Field Kind. Library-supplied Field Kinds use reserved short names; a Custom Field Kind uses a reverse-domain name and an integer format version.
_Avoid_: Display label, package name

**Field Group**:
A named, reusable fragment of Field definitions composed into one or more Content Types or Field Groups. A nested composition mounts it under a new Field Key as an object; an inline composition merges its Fields and rejects key collisions without renaming or prefixing them. The active Definition Snapshot rejects every Field Group inclusion cycle.
_Avoid_: Editor panel, fieldset

**Asset**:
An immutable persisted file and its metadata, referenced by Entries rather than embedded in their content. In the Example CMS, an Asset is an image with filename, MIME type, dimensions, and default alt text. Deleting an Asset requires explicit confirmation and automatically clears its optional image assignments.
_Avoid_: Media-library item, upload

## Definition lifecycle

**Content Definition**:
A serializable definition of either a Content Type or a Field Group, identified by an immutable URL-safe lowercase identifier independently of its editable human-readable name.
_Avoid_: Model, collection configuration

**Definition Revision**:
An immutable, versioned Content Definition captured from a complete, self-valid draft.
_Avoid_: Mutable definition, in-place edit

**Definition Space**:
One isolated set of Content Definitions and their lifecycle history for a Headless CMS.
_Avoid_: Built-in tenant, global model store

**Definition Snapshot**:
One complete, immutable selection of Definition Revisions that forms a valid content-definition graph for a Definition Space.
_Avoid_: Live mutable registry, partial activation

**Definition Catalog**:
The durable lifecycle record for a Definition Space, including Definition Revisions, Definition Snapshots, and lifecycle events.
_Avoid_: Active runtime schema cache

**Definition Registry**:
The runtime view of a Definition Space's active Definition Snapshot and its compiled schemas.
_Avoid_: Definition history store, authoring UI state
