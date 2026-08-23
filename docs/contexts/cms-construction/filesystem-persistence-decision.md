# Filesystem Entry and Asset Persistence Contracts

## Decision

The v0.1 Bun Filesystem Persistence Layer owns one exclusively controlled local storage root and supports exactly one initialized writer process for that root. It serializes in-process mutations while allowing concurrent reads. It supports tested local filesystems on macOS, Linux, and Windows; multiple writer processes, network shares, synchronized folders, FUSE filesystems, and externally modified roots are unsupported.

The Layer uses generated, opaque, URL-safe logical Entry IDs and Asset IDs. Its physical filenames and directory layout are private. No Content Type identifier, slug, original filename, MIME type, URL, or Entry Field value contributes to a physical path. The root has a Layer-owned versioned format marker and active manifest. Initialization creates these only in an empty root and rejects an unexpected, incompatible, or externally modified root with a structured failure.

Every reader resolves the active manifest once and uses that immutable generation for the complete read or Asset byte stream. A mutation first writes immutable records and Asset Blobs, then publishes one active-manifest replacement as its reader-visible commit point. Readers therefore observe the complete old generation or complete new generation, including mutations that affect multiple records. Superseded data is reclaimed later only after it is unreachable from the active manifest and any protected in-flight generation.

The Layer has two explicit acknowledgement policies. `atomic` publishes a complete sibling-staged value with one rename and does not promise that an acknowledged mutation survives power loss. `durable` additionally synchronizes the staged data and parent directory metadata, and initialization fails when the required synchronization capability is unavailable. Neither policy treats a direct write, `FileSink.flush()`, timestamp, lockfile, or watcher event as a transaction boundary.

An Asset has a generated Asset ID and immutable validated metadata. Its immutable Asset Blob is addressed by the cryptographic digest of streamed bytes, so separately created Assets may share bytes while retaining independent metadata and lifecycle. Ingestion is backpressure-aware, bounded by configured byte and metadata limits, and removes its staging file after cancellation, limit rejection, or failure. The persistence read contract returns metadata and a one-shot byte stream; public URLs, range requests, caching headers, and content disposition belong to the Headless API.

Generic Asset deletion returns `AssetReferenced` while a live Entry refers to the Asset. A CMS Builder that wants cascading behavior, such as the Example CMS clearing optional image assignments, issues an explicit batch mutation before deletion. Revision retention and optimistic-concurrency tokens remain separate Entry-history decisions.

The Layer may serve a supported Entry Query with a bounded authoritative-record scan. It declares its Query Capabilities and configured resource limits, returning `UnsupportedQueryCapability` or a resource-limit failure rather than approximating a result. Derived indexes are disposable accelerators, rebuilt from the authoritative generation; they are never co-equal commit participants.

Startup ignores staging files for reads, removes only files matching the Layer's exact abandoned-staging convention, validates the manifest, Entry encodings, Asset metadata, and path invariants, and rebuilds disposable indexes. It retains corrupt committed data as evidence and returns a structured corruption failure. Asset-byte digests are verified while their streams are read, with an optional maintenance scan for whole-root verification.

The configuration has hard limits for Entry encoding size, Asset byte size, metadata size, and query scan work. Structured failures distinguish invalid input, conflict, unsupported capability, permission, capacity, corruption, and transient I/O.

## Deferred decisions

- Entry Revision retention, restoration, and optimistic-concurrency write tokens are defined by issue #16.
- Content-definition migration commit behavior is defined by issue #10.
- The Headless API's wire representation and Asset HTTP delivery are defined by issue #9.
- The Example CMS's explicit Asset-replacement and optional-image-clearing commands are part of its application decision.
