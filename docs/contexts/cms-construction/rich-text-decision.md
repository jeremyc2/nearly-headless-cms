# Rich Text Authoring and Rendering Contract

## Decision

`rich-text` is a built-in Field Kind whose persisted value is a JSON-compatible, semantic document. A value declares its stable document format identifier and integer format version, then carries an ordered tree of nodes. The core v0.1 vocabulary contains document blocks (`paragraph`, `heading`, ordered and unordered lists, list items, quote, and code block); inline nodes (`link` and `entry-reference`); block nodes (`asset-reference`); and text leaves with the semantic marks `bold`, `italic`, `code`, and `strikethrough`.

The document contains no HTML, CSS, component names, editor selections, layout instructions, or arbitrary attributes. A node is valid only when its required data, child placement, and child kinds match the format contract. URLs are data subject to the ordinary URL constraint; text and link labels are authored content. The library validates and persists this structure without converting it to HTML or inferring presentation.

An `entry-reference` carries a live Entry ID and authored inline children used as its label. An `asset-reference` carries a live Asset ID, authored alternative text, and an optional authored caption. They are not copies of the target Entry or Asset. The persistence contract validates these targets atomically with the containing Entry write, prevents target deletion while referenced from Rich Text, and returns a reference-blocked deletion failure without exposing referrers. A Content Client resolves an accepted reference through the Headless API and chooses its URL, loading behavior, image layout, and fallback presentation. Rich Text itself does not perform implicit target expansion.

A CMS Builder may register a versioned Rich Text extension with a reverse-domain node identifier, JSON-compatible configuration, deterministic value validation, child-placement rules, and an explicit declaration of its reference behavior. The registry contains no executable code. Generic Rich Text validation accepts an extension only when the active Definition Snapshot names a registered supported version. A portable renderer must fail visibly for an unknown extension rather than drop it, serialize it as HTML, or guess at its visual meaning. The Example CMS and Public Blog use only the core vocabulary in v0.1; a builder that needs a client-specific extension supplies matching authoring and rendering handlers outside the reusable library.

The Example CMS authoring interaction edits the semantic tree: block choice, inline marks, links, references selected from existing Entries or Assets, and ordinary undo/redo local to the UI. The reusable library supplies neither an editor component nor editor state. Before save, the CMS validates the complete Rich Text value through the active Rich Text contract; failed validation leaves the persisted Entry unchanged. The Example CMS requires non-empty alternative text for an image used in a published Post, as builder-defined publication validation rather than a generic editorial rule.

Rich Text document format versions are immutable persisted contracts. A core or registered extension version change is compatible only when every stored document remains valid with identical representation. Any other change is a Content Definition migration: its registered migration handler transforms each affected document deterministically, validates it against the target Rich Text contract and live references, then participates in the existing staged atomic Definition Cutover. A migration may not invent labels, captions, alternative text, or other editorial content. Historical Entry Revisions retain their captured Rich Text values and are revalidated if restored under a newer active definition.

## Consequences

- Content Clients receive a safe structured value and own their renderers; the Public Blog does not import the CMS UI or depend on HTML emitted by it.
- Entry and Asset references are observable in the stored tree while retaining the same integrity guarantees as dedicated reference Fields.
- Builders can extend Rich Text deliberately without making an unknown node silently disappear for generic clients.
- Rich Text query capability remains absent in v0.1: a Field Path cannot descend into a Rich Text document, and it cannot be filtered, sorted, or made unique through generic operations.
- The headless transport decision must carry format/version information and make unsupported Rich Text extensions explicit to a Content Client.

## Deferred decisions

- The precise transport representation, content-client capability negotiation, and asset delivery URLs belong to issue #9.
- The selected Example CMS editor toolkit and Public Blog rendering implementation belong to issue #6.
