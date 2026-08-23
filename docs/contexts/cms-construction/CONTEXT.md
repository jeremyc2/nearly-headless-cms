# CMS Construction

CMS Construction is the language of the reusable library for defining and operating a headless CMS while leaving infrastructure, user interface, and presentation choices to its builder.

## Language

**CMS Builder**:
A developer who uses the Nearly Headless CMS library to assemble a CMS with their chosen user interface and integrations.
_Avoid_: Package consumer, integrator

**Rich Text**:
The JSON-compatible, versioned semantic document value of the built-in `rich-text` Field Kind. It contains only contracted structural nodes, inline nodes, text leaves, semantic marks, and validated Entry or Asset references; it contains no HTML, CSS, editor state, or presentation instructions. A Content Client renders it with its own presentation.
_Avoid_: Styled text, HTML blob

**Rich Text Extension**:
A CMS Builder-registered versioned Rich Text node contract with a reverse-domain identifier, JSON-compatible configuration, deterministic value validation, child-placement rules, and explicit reference behavior. Generic validation rejects an unregistered version and a portable renderer must fail visibly rather than silently discard an unknown extension.
_Avoid_: Custom widget, arbitrary embedded component

**Rich Text Reference**:
An `entry-reference` or `asset-reference` node in a Rich Text document, storing a live target identifier rather than copying target data. Its target is atomically validated and restricts target deletion; resolving it for display is a Content Client responsibility.
_Avoid_: Embedded Entry, image URL

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
The versioned public HTTP boundary through which a Content Client invokes only CMS Builder-selected queries and commands without importing the Headless CMS implementation, reusable library, or an SDK.
_Avoid_: Management API, SDK, direct CMS dependency

**Management API**:
The versioned HTTP boundary through which a CMS user interface invokes authoring, definition-lifecycle, history, and other management operations exposed by a Headless CMS. It is distinct from the narrower Headless API even when one HTTP transport hosts both.
_Avoid_: Headless API, public content API

**Typed Client Binding**:
App-local source generated from a Headless API contract that types its stable HTTP operations without introducing a runtime dependency on the Headless CMS, reusable library, or an SDK package. Dynamic Entry values remain subject to runtime decoding against serializable definition data.
_Avoid_: Shared SDK, direct CMS dependency

**Delivery Query**:
A named, CMS Builder-defined Headless API read operation with an explicit public request and response contract. It fixes all non-public selection rules in its handler rather than exposing unrestricted generic Entry Query behavior.
_Avoid_: Generic Entry Query, public database query

**Delivery Command**:
A named, CMS Builder-defined Headless API mutation with an explicit public request and response contract. It accepts only caller-owned input and assigns protected values through its handler.
_Avoid_: Generic CRUD endpoint, unrestricted mutation

**Delivery Operation**:
The composition-time declaration of one Delivery Query or Delivery Command, including its stable identifier, HTTP method and path, request and response schemas, reachable Content Types, and CMS Builder handler. Activating a Definition Snapshot may change its runtime content shapes but cannot add, remove, or rename a Delivery Operation.
_Avoid_: Dynamic route, generic CMS operation

**Management Operation**:
A named, CMS Builder-defined operation that adds a CMS-specific authoring or administrative workflow to the static Management API contract. Its handler uses ordinary authorized CMS operations and cannot obtain a privileged bypass.
_Avoid_: Generic CMS operation, Delivery Operation

**Asset Delivery Operation**:
The optional canonical Headless API operation through which a Content Client resolves an authorized Asset ID to immutable bytes and public response metadata. Its CMS Builder handler applies delivery-specific policy before invoking the ordinary authorized Asset read; possession of an Asset ID never grants access by itself.
_Avoid_: Public storage directory, Asset ID as capability

**Public Content Export**:
A builder-defined Delivery Query that reads one immutable persistence generation and returns the complete bounded public dataset a static Content Client needs. It provides build coherence without changing generic cursor pagination into a cross-request snapshot.
_Avoid_: Database backup, generic query snapshot

**API Contract Version**:
The major version of a Management API or Headless API's stable HTTP shapes and semantics. It is independent of the active Definition Snapshot and its fingerprint.
_Avoid_: Definition Revision, Definition Snapshot fingerprint

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
The CMS Builder-supplied policy boundary that returns allow or forbid for one library-defined Action on a minimal Resource descriptor in the context of a Current Identity. Every public generic CMS operation invokes it once before validation or persistence; an expanded read additionally invokes it once for the complete Relationship Expansion plan. A denial returns `Forbidden` without first checking resource existence, and there is no built-in trusted bypass. It does not rewrite queries, redact values, impose rate limits, create audit records, or encode editorial workflow.
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
One portable Field Kind supplied by the reusable library: constrained scalar, structured JSON, Asset, Relationship, or Rich Text. Asset, Relationship, and Rich Text share the Field boundary while their specialized value semantics are defined independently. `rich-text` uses the semantic versioned document contract and has no portable generic query capability within its tree.
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

**Entry Revision**:
An immutable complete snapshot of an Entry stored by a history-enabled Content Type after a successful create, update, or restore. It is distinct from the current live Entry and may remain inspectable after deletion.
_Avoid_: Mutable draft, current Entry

**Write Token**:
An opaque value representing one current Entry state. A history-enabled Entry mutation supplies the token returned by a prior full read or successful write; a mismatch returns Conflict without writing. It is distinct from an Entry Revision number and absent from ordinary Entry projections.
_Avoid_: Revision number, timestamp, ETag

**Entry History**:
The retained sequence of Entry Revisions and, after deletion, its deletion record for one Entry of a history-enabled Content Type. Ordinary Entry reads and queries never expose deleted Entries; history operations can inspect and restore them until permanent purge.
_Avoid_: Audit log, event stream

**Deletion Record**:
The retained history state created when a history-enabled Entry is deleted. It makes the Entry absent from ordinary operations while preserving its prior Entry Revisions for inspection or restoration.
_Avoid_: Soft-delete flag, tombstone Entry

**Permanent Purge**:
The irreversible removal of a deleted Entry and its entire Entry History. It is the only generic operation that removes retained history.
_Avoid_: Delete, retention cleanup

**Revision Retention Policy**:
An optional Content Type policy for a history-enabled Entry that retains revisions indefinitely by default and may bound retained history by revision count, age, or both. It never removes the current revision or latest Deletion Record.
_Avoid_: Backup schedule, cache eviction

**Current Entry State**:
The complete current Entry and its Write Token, returned only by a history-aware state read and successful history-enabled writes. It is separate from the projection-friendly Entry Representation returned by ordinary reads and queries.
_Avoid_: Entry Representation, revision snapshot

**Revision Number**:
The immutable, per-Entry, monotonically increasing identifier of an Entry Revision. Revision listings are newest-first and cursor-paginated; a restore records the Revision Number it restored from as history metadata.
_Avoid_: Write Token, global revision sequence

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
The caller-requested read-time replacement of a Relationship Field's Entry IDs with Entry representations. After the base read is authorized, the complete requested plan is authorized once as a separate generic Action before validation or lookup. Expansion is never implicit and is bounded and cycle-safe without per-target filtering or redaction.
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
An immutable persisted file and its metadata, referenced by Entries rather than embedded in their content. In the Example CMS, an Asset is an image with filename, MIME type, dimensions, and default alt text. Generic deletion fails while an Entry references the Asset; a CMS Builder may offer an explicit batch command that clears optional image assignments before deleting it.
_Avoid_: Media-library item, upload

**Asset Blob**:
The immutable bytes of an Asset, identified by their cryptographic digest. An Asset has its own generated Asset ID and metadata, so separate Assets may share one Asset Blob when their bytes are identical.
_Avoid_: Asset ID, upload filename

**Filesystem Persistence Layer**:
A CMS Builder-provided Entry and Asset persistence implementation that owns one local storage root. It exposes only logical Entry and Asset identifiers; its directory layout and physical filenames are private implementation details.
_Avoid_: Content directory, public asset URL

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

**Public Definition Snapshot**:
The serializable subset of an active Definition Snapshot reachable through a Headless API's Delivery Queries and Delivery Commands. It includes the Field Kind, capability, and Rich Text extension metadata a Content Client needs for runtime decoding but contains no executable validator or compiled schema.
_Avoid_: OpenAPI document, compiled Effect Schema

**Definition Catalog**:
The durable lifecycle record for a Definition Space, including Definition Revisions, Definition Snapshots, and lifecycle events.
_Avoid_: Active runtime schema cache

**Definition Registry**:
The runtime view of a Definition Space's active Definition Snapshot and its compiled schemas.
_Avoid_: Definition history store, authoring UI state

**Migration Step**:
A CMS Builder-supplied, versioned transformation that converts persisted Entry values from one Definition Snapshot to another. The library may classify a Definition change as safe but never invents a lossy or editorial transformation.
_Avoid_: Automatic schema update, implicit data conversion

**Atomic Definition Cutover**:
The commit that makes a target Definition Snapshot and its migrated Entries current together, so operations observe either the prior consistent state or the target consistent state, never a mixture.
_Avoid_: Rolling schema deployment, partial activation

**Compatible Definition Change**:
A Content Definition change that preserves every persisted Entry value's validity and representation, so the library may activate its Definition Snapshot without a Migration Step.
_Avoid_: Probably safe change, automatic migration

**Definition Rollback**:
An Atomic Definition Cutover from the active Definition Snapshot to an earlier Definition Snapshot through an explicit Migration Step. It is a new migration, not an implied reversal or stale-data restore.
_Avoid_: Undo, time travel

**Migration Manifest**:
The immutable, serializable Catalog record of a Migration Step, naming its source and target Definition Snapshots and its stable handler identifier and version. It describes a transformation without containing executable code.
_Avoid_: Serialized migration function, mutable migration configuration

**Migration Handler**:
A CMS Builder-registered versioned transformation implementation selected by a Migration Manifest. It produces fully valid target Entry values but is not persisted in the Definition Catalog.
_Avoid_: Stored procedure, automatic converter

**Migration Preparation**:
The validated target Entry generation produced before an Atomic Definition Cutover. It records its source generation and becomes stale if a source Entry write commits before cutover.
_Avoid_: Live in-place migration, write lock

**Migration Failure Report**:
A typed preparation result that identifies a missing Migration Handler or Entry transformation and validation failures without changing the active Definition Snapshot or current Entries.
_Avoid_: Partial migration, best-effort conversion

**Migration Path**:
The unique directed sequence of Migration Manifests that transforms Entry values from one Definition Snapshot to another. Activation uses one direct step; a historical restore may traverse a path to the active snapshot.
_Avoid_: Assumed reversal, arbitrary conversion route

**One-to-one Migration**:
A generic Migration Step that deterministically transforms one current Entry into one current Entry with the same Entry ID and Content Type. It cannot create, delete, move, or coordinate Entries.
_Avoid_: Data reshaping job, bulk content operation
