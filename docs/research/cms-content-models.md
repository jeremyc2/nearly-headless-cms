# CMS content-model patterns

Research date: 2026-08-22

## Question

What can Nearly Headless CMS learn from WordPress with Advanced Custom Fields (ACF) and from established headless CMS content models when defining flexible fields, reusable field groups, relationships, rich text, generic entry operations, and opt-in entry history? In particular, can WordPress operate headlessly, and how should this library avoid assigning lifecycle meaning to a CMS Builder's ordinary `status` field?

## Factual findings

The product descriptions below are sourced facts. Paragraphs explicitly marked **Synthesis** are inferences drawn across those sources; design proposals are confined to the later Recommendations section.

### WordPress can be used as a headless CMS

In a headless WordPress setup, WordPress supplies the content-management layer while a separately served frontend obtains content through an API and owns the generated presentation. WordPress.com describes REST and GraphQL as possible connections and explicitly names Astro among the possible frontend frameworks. [WordPress.com: What Is Headless WordPress?](https://wordpress.com/blog/2025/03/20/headless-wordpress/)

WordPress core's REST API sends and receives JSON, exposes public site content generally without authentication, applies authentication restrictions to private content, and is intended to support separate applications and replacement administration or frontend experiences. [WordPress REST API Handbook](https://developer.wordpress.org/rest-api/)

WordPress exposes resource-oriented endpoints for posts, pages, taxonomies, media, revisions, users, and other built-in resources. A custom post type becomes available under the REST API when its registration enables `show_in_rest`, and it can receive a custom REST route base. [WordPress REST API reference](https://developer.wordpress.org/rest-api/reference/), [Adding REST support for custom content types](https://developer.wordpress.org/rest-api/extending-the-rest-api/adding-rest-api-support-for-custom-content-types/)

This answers the narrow feasibility question: WordPress can be configured as a headless content backend. It does not establish that WordPress's built-in post, author, status, theme, or authentication concepts are the right abstractions for a library whose CMS Builder supplies those policies.

### ACF's model is fields attached through field groups

ACF is a WordPress plugin for adding custom fields to WordPress data such as posts, pages, taxonomies, and users. It stores that additional data in the relevant WordPress metadata or options storage according to where the field group is displayed. [ACF security principles](https://www.advancedcustomfields.com/resources/acf-security-principles/)

An ACF field group contains a title, fields, location rules, and presentation/general settings. Location rules determine the edit screens or post objects to which the group applies and support grouped `and`/`or` conditions; a common rule is equivalent to “Post Type is Post.” [Creating a Field Group](https://www.advancedcustomfields.com/resources/creating-a-field-group/), [Custom location rules](https://www.advancedcustomfields.com/resources/custom-location-rules/)

An ACF field is the individual custom-data building block. Per-field settings include labels, instructions, defaults, requiredness, and conditional display logic. [ACF frequently asked questions](https://www.advancedcustomfields.com/resources/frequently-asked-questions)

Field-group reuse is distinct from field-group attachment. ACF PRO's Clone field references existing fields or whole field groups at runtime rather than duplicating their database definitions; it can either inline the selected fields or expose them as grouped subfields, with optional name prefixing to prevent collisions. [ACF Clone field](https://www.advancedcustomfields.com/resources/clone/), [How to Use the Clone Field](https://www.advancedcustomfields.com/resources/how-to-use-the-clone-field/)

ACF field groups are excluded from WordPress REST responses by default and opt in individually. Once enabled, their values are available through the corresponding core endpoints for posts, custom post types, revisions, taxonomies, or other attached WordPress resources. [ACF REST API integration](https://www.advancedcustomfields.com/resources/wp-rest-api-integration/)

**Synthesis:** The portable distinction suggested by ACF is:

- a **field** describes one value;
- a **field group** organizes fields and can be selected for reuse;
- an **attachment/location rule** decides which kind of content receives that group;
- an **entry** (a WordPress post or another WordPress object in ACF's implementation) holds the resulting values.

ACF's exact storage and location-rule machinery is WordPress-specific, but its separation of field definition, reusable composition, and attachment is portable.

### Terminology and composition across headless CMSs

There is no universal CMS vocabulary. The products below repeatedly separate a schema-level definition from a stored content record, while choosing different names for each side.

| Product | Schema vocabulary | Stored-value vocabulary | Composition pattern |
| --- | --- | --- | --- |
| Contentful | A space has a **content model** made of **content types**, and each content type defines **fields**. [Contentful data model](https://www.contentful.com/developers/docs/concepts/data-model/) | An **entry** adheres to one content type. [Contentful entries](https://www.contentful.com/developers/docs/references/content-management-api/entries/) | Fields include primitives, arrays, references to entries, links to assets, rich text, and JSON objects. [Contentful data model](https://www.contentful.com/developers/docs/concepts/data-model/) |
| Sanity | A Studio **schema** describes the content model. Standalone stored values use **document types**, while reusable structured values use **object types**. [Sanity schemas and forms](https://www.sanity.io/docs/studio/schemas-and-forms), [Sanity document versus object types](https://www.sanity.io/docs/help/toplevel-objects-to-document-type) | A stored value is a **document**. [Sanity schemas and forms](https://www.sanity.io/docs/studio/schemas-and-forms) | Reusable object types compose fields without becoming independently managed documents. [Sanity document versus object types](https://www.sanity.io/docs/help/toplevel-objects-to-document-type) |
| Payload | A **collection** is a group of **documents** that share a schema, and **fields** determine document structure. [Payload collection configs](https://payloadcms.com/docs/configuration/collections) | A stored record is a **document**. [Payload collection configs](https://payloadcms.com/docs/configuration/collections) | A named Group field creates a nested object; an unnamed Group can be presentation-only. Blocks can be defined once and referenced by slug in multiple collections or rich-text fields. [Payload Group field](https://payloadcms.com/docs/fields/group), [Payload Blocks field](https://payloadcms.com/docs/fields/blocks) |
| Directus | A **collection** is generally a table-like set of **items**; a **field** combines column configuration with application interaction/display configuration. [Directus data model](https://docs.directus.io/app/data-model) | A stored record is an **item**. [Directus data model](https://docs.directus.io/app/data-model) | Directus exposes explicit relational modeling over collections, including one-to-one, many-to-one, one-to-many, many-to-many, and polymorphic many-to-any relationships. [Directus relationships](https://docs.directus.io/app/data-model/relationships) |

**Synthesis:** Contentful's **content type / entry** pair is the least coupled to a database representation. Payload's **collection / document** and Directus's **collection / item** pairs are coherent, but “collection” carries a stronger implication that the definition and stored set are the same public abstraction. The comparison does not reveal an industry-standard reason to use both “content type” and “collection” for the same concept.

### Relationships are explicit schema elements

Contentful models a reference as a link to another entry and models a multi-reference field as an array of such links. [Contentful data model](https://www.contentful.com/developers/docs/concepts/data-model/)

Sanity's `reference` schema type names the allowed target document types. Its default strong reference requires the target to exist and prevents deleting a referenced target; a weak reference relaxes those guarantees, and an array of references represents a to-many relationship. [Sanity Reference type](https://www.sanity.io/docs/studio/reference-type)

Payload relationship fields explicitly declare one or more target collection slugs and independently select one or many values. Its REST API can populate relationships to a caller-selected depth. [Payload Relationship field](https://payloadcms.com/docs/fields/relationship), [Payload REST API](https://payloadcms.com/docs/rest-api/overview)

Directus distinguishes relationship shape from query-time expansion: relations are part of the data model, while API callers select nested fields and can apply nested `deep` query parameters. [Directus relationships](https://docs.directus.io/app/data-model/relationships), [Directus global query parameters](https://docs.directus.io/reference/query)

**Synthesis:** Across these systems, a relationship is not merely an unvalidated string ID. The field definition identifies its target constraints and cardinality, while retrieval controls how much target data is resolved.

### Rich text is structured data, not prescribed presentation

Contentful returns rich text as a JSON abstract syntax tree rather than HTML. Its nodes preserve structure and semantic marks such as bold and italic, and linked entries or assets remain references so a consuming frontend can choose its own HTML and components. [Contentful rich text](https://www.contentful.com/developers/docs/concepts/rich-text/)

Sanity's Portable Text is a JSON-based rich-text specification intended to serialize into different markup formats. Sanity's presentation guide states that the consumer transforms Portable Text into its chosen output and handles custom content types during serialization. [Portable Text guide](https://www.sanity.io/docs/developer-guides/beginners-guide-to-portable-text), [Presenting Portable Text](https://www.sanity.io/docs/developer-guides/presenting-block-text)

Payload stores its Lexical rich-text value as JSON and converts it to HTML, JSX, Markdown, or other outputs through frontend converters; custom block renderers determine how block content appears. [Payload Lexical converters](https://payloadcms.com/docs/rich-text/converters), [Payload rich-text blocks](https://payloadcms.com/docs/rich-text/blocks)

**Synthesis:** These models preserve author intent and document structure while leaving typography, CSS, components, routes, and final markup to the content-consuming application.

### Generic CRUD and queries can be generated from a content definition

Payload generates Local, REST, and GraphQL APIs for documents from collection configurations and exposes generic REST create, read, update, delete, count, pagination, filtering, sorting, projection, and relationship-population operations. [Payload collection configs](https://payloadcms.com/docs/configuration/collections), [Payload REST API](https://payloadcms.com/docs/rest-api/overview)

Directus's item format follows the configured collections and fields, while its cross-endpoint query parameters cover field projection, filtering (including related-item conditions), full-text-like search, sorting, pagination, and nested relational queries. [Directus items API](https://docs.directus.io/reference/items), [Directus global query parameters](https://docs.directus.io/reference/query)

**Synthesis:** This provides precedent for deriving generic entry operations from a registered content model without assigning domain meaning to particular builder-defined fields.

### Revision history and publishing status are separate design axes

Payload's opt-in Versions feature stores document versions over time and can operate without Drafts; when Drafts are enabled separately, Payload injects an internal `_status` field and changes validation and write behavior. [Payload Versions](https://payloadcms.com/docs/versions/overview), [Payload Drafts](https://payloadcms.com/docs/versions/drafts)

Directus enables Content Versioning per collection. A content version is an unpublished delta from the main item that can later be promoted, while Directus also records ordinary item revisions associated with activity. [Directus collections](https://docs.directus.io/app/data-model/collections), [Implementing Content Versioning](https://docs.directus.io/guides/headless-cms/content-versioning), [Directus glossary](https://docs.directus.io/user-guide/overview/glossary)

Sanity exposes a History API that retrieves prior document revisions by revision ID or timestamp. Its revision retention window is a separate plan-level concern, while the latest draft and published states remain available. [Sanity History API](https://www.sanity.io/docs/http-reference/history), [Sanity history experience](https://www.sanity.io/docs/user-guides/history-experience)

WordPress exposes post revisions as their own REST resource. WordPress posts also have a separate built-in status field with values including `draft`, `pending`, `future`, `private`, and `publish`. [WordPress Post Revisions](https://developer.wordpress.org/rest-api/reference/post-revisions/), [WordPress Posts API](https://developer.wordpress.org/rest-api/reference/posts/)

Contentful requires the current content-type or entry version number when updating a resource; that version header is an optimistic-concurrency mechanism and should not be confused with a user-facing entry-history model. [Contentful content types API](https://www.contentful.com/developers/docs/references/content-management-api/content-types/), [Contentful entries API](https://www.contentful.com/developers/docs/references/content-management-api/entries/)

**Synthesis:** The products vary substantially in publishing workflow, but they demonstrate that revision storage, optimistic concurrency, drafts, and builder-defined status-like data are separable capabilities.

## Recommendations for Nearly Headless CMS

These are design recommendations derived from the findings, not descriptions of how the compared products must work.

### 1. Standardize on Content Type and Entry

Use the following public vocabulary in the reusable library:

- **Content Type**: a named schema that defines the fields accepted by one kind of content.
- **Entry**: one persisted value conforming to a Content Type.
- **Field**: one named, typed part of an Entry schema.
- **Field Group**: a named reusable fragment of Field definitions, composed into one or more Content Types.

Avoid introducing **Collection** as a second name for Content Type. If “collection” appears at all, reserve it for an ordinary returned set such as `ReadonlyArray<Entry>`, not a separately defined domain object. This keeps the API independent of whether an adapter stores entries in SQL tables, filesystem directories, documents, or another form.

### 2. Keep Field Group reuse separate from field layout and attachment

Model a Field Group as a schema component, not as an editor panel. A CMS Builder should be able to define a group once and compose it into several Content Types.

Support two explicit composition modes only if both are required:

- **nested**: mount a group under a field name and produce a nested object;
- **inline**: merge its fields into the containing Content Type and reject name collisions during definition validation.

Do not put UI layout, tabs, widgets, or CSS-oriented metadata into the core Field Group contract. A CMS UI adapter can associate its own presentation metadata with stable content-type, group, and field identifiers. ACF and Payload demonstrate why storage shape and visual grouping must not be silently treated as the same operation.

### 3. Compile definitions into runtime schemas

Treat the CMS Builder's Content Type and Field Group definitions as declarative input that the library compiles into an immutable registry and Effect Schema validators. Validation and group resolution are core deterministic behavior; they should not require a swappable user-provided Layer.

Reserve public Effect service requirements and Layers for capabilities that cross an I/O or policy boundary, such as entry persistence, asset persistence, authorization, clocks/ID generation where needed, and a builder-selected transport. This keeps pure, deterministic definition work out of adapter composition.

### 4. Make relationships typed references with caller-controlled resolution

A Relationship Field should declare:

- one or more allowed target Content Type identifiers;
- cardinality (`one` or `many`);
- required/optional semantics;
- referential-integrity policy, if the storage adapter can support more than existence validation.

Persist stable references, not copied target entries. Keep expansion separate: generic read/query operations should accept an explicit resolution plan, projection, or depth rather than recursively resolving every relation. This preserves predictable costs and permits a filesystem adapter to implement the same contract as a database adapter.

### 5. Define Rich Text as a versioned semantic document format

The core Rich Text field should hold a JSON-compatible tree with stable node discriminants, block/inline structure, text leaves, semantic marks such as strong and emphasis, links, and typed references to assets or entries. Ship Effect Schemas/codecs plus traversal utilities and extension points for custom nodes.

Do not make stored HTML, CSS classes, editor components, or a canonical HTML renderer part of the content contract. The authoring UI chooses how the value is edited; the blog or any other head consumes the tree and chooses how it is rendered. A format version on the Rich Text document is useful for migrations and is distinct from Entry revision history.

### 6. Put generic behavior in an Entry service and keep queries semantic-neutral

Offer generic operations keyed by Content Type and Entry ID: create, get, update, delete, list/query, and relationship-aware reads. The query model should cover at least filters, boolean composition, sorting, pagination, field projection, and explicit relationship expansion, with adapter capability errors when an implementation cannot support an operation efficiently.

Field names remain opaque to the core query engine. For the Example CMS, `status`, `author`, `publishDate`, categories, and tags are ordinary CMS Builder-defined fields. The Example CMS can issue a normal predicate such as `status == "published"`; the library must not discover that field by name, inject it, alter validation for drafts, or hide entries based on it.

Likewise, an `author` Relationship Field points to an Author Entry. It conveys no authentication identity and does not depend on a current user.

### 7. Make Entry history opt in per Content Type and independent of status

Place Entry-history configuration on the Content Type definition, for example as disabled by default or as a policy containing retention limits. When enabled, define explicit operations to list revisions, retrieve a revision, compare metadata, and restore a prior revision. Decide separately whether creation, update, deletion, and restoration each create revisions.

Do not implement entry history by interpreting a builder's `status` field. Do not inject draft/published states as a side effect of enabling history. Also keep these three versions distinct in both names and types:

1. **definition format version** — the library's serialized Content Type/Field Group format;
2. **entry revision** — a historical snapshot or delta of an Entry;
3. **write revision/token** — an optimistic-concurrency value used to prevent lost updates.

Field Groups may need stable IDs and a definition format version so definitions can evolve safely, but they do not themselves receive Entry revisions because they are not Entries.

## Decisions this research supports

- WordPress plus ACF is a valid precedent for a headless backend with fields and reusable field groups, but its post/user/status/theme model should not be copied wholesale.
- The cleanest library vocabulary is **Content Type**, **Entry**, **Field**, and **Field Group**; “Collection” is unnecessary at the public domain level.
- Generic CRUD/query behavior, relationships, definition validation, group resolution, and opt-in Entry history belong in the reusable library.
- Persistence, assets, authorization policy, and transport belong behind Effect service interfaces supplied through Layers; pure definition compilation and validation do not need builder-supplied Layers.
- Rich Text should preserve semantic authoring structure while leaving every presentation decision to the consuming head.
- Entry history must be independent from any custom `status` field, including the Example CMS's draft/published values.

## Remaining design questions

1. Is nested Field Group composition sufficient for v0.1, or must inline composition also be supported?
2. Which primitive and compound Field types constitute the v0.1 closed set, and how can third parties extend it without weakening validation or query portability?
3. Which referential-integrity guarantees are mandatory for every storage adapter, especially on deletion?
4. What is the minimum portable query algebra, and how should adapters report unsupported or inefficient queries?
5. Are Entry revisions full snapshots or storage-adapter-defined representations behind a behavioral contract?
6. What retention, deletion, restoration, and optimistic-concurrency semantics are required for v0.1?
7. How are changes to Content Type and Field Group definitions migrated across already-persisted Entries?
