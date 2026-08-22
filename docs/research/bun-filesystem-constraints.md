# Bun filesystem persistence constraints

Research date: 2026-08-22

## Question

Which guarantees and constraints in Bun and the underlying filesystem should shape portable filesystem Layers for Entries and assets, including atomic writes, concurrency, locking, directory traversal safety, crash recovery, streaming, metadata, watchers, portability, and testability?

## Executive answer

The portable v0.1 filesystem implementation should be a **local-filesystem, single-writer-per-root Layer**. It should serialize mutations inside its Bun process, publish each logical record by writing a unique sibling temporary file and renaming it into place, expose an explicit durability policy, and never treat a direct `Bun.write()`, `FileSink.flush()`, timestamp, lockfile, or watcher event as a transaction boundary.

Entries and asset metadata should use the same staged-write primitive. Asset bytes should be streamed into immutable, generated paths (preferably content-addressed), while user filenames remain metadata. The storage root must be exclusively controlled by the CMS process; a portable JavaScript path API cannot turn a concurrently hostile directory tree into a secure sandbox. Startup recovery should validate committed data and remove only recognizable abandoned staging files. Multi-process writers, remote/network filesystems, and externally mutated roots require a stronger adapter and are outside this Layer's portable guarantee.

## Source findings

### Bun supplies the data plane, not a persistence protocol

The repository currently bundles Bun 1.4.0 documentation. Bun recommends `Bun.file` and `Bun.write` for optimized file I/O and directs callers to its `node:fs` implementation for operations those APIs do not cover. `Bun.file` is lazy and exposes a `ReadableStream`; `Bun.write` accepts strings, binary values, files, and responses; and `FileSink` incrementally buffers chunks until `flush()` or `end()`. [Bun File I/O](https://bun.com/docs/runtime/file-io), [Bun Node.js compatibility](https://bun.com/docs/runtime/nodejs-compat)

Those APIs do not document atomic replacement, mutual exclusion, or power-loss durability. In particular, Bun's streaming-write guide says that `BunFile.writer()` does **not** truncate an existing file and suggests deleting it first. Delete-then-write is unsuitable for live CMS data because readers can observe a missing or partially rewritten file. The safe use is to stream into a newly and exclusively created staging file, close it, and publish it separately. [Bun: Write a ReadableStream to a file](https://bun.com/guides/write-file/stream)

`FileSink.flush()` drains Bun's buffer to the file or pipe; it is not documented as the equivalent of `fsync`. Durable mode therefore has to use the `node:fs` `FileHandle.sync()` contract after all bytes are written. `FileSink.write()`, `flush()`, and `end()` may return promises, so a streaming implementation must await pending results rather than assume every write completed synchronously. [Bun `FileSink` reference](https://bun.com/reference/bun/FileSink), [Node.js `FileHandle.sync()`](https://nodejs.org/api/fs.html#filehandlesync)

### Atomic visibility comes from one same-filesystem rename

POSIX `rename()` replacement keeps the destination name visible throughout the operation and makes it refer to either the old or new file; the standard's rationale explicitly calls the operation atomic. It can fail with `EXDEV` when source and target cross filesystems. Therefore, a temporary file intended for publication must be created in the target directory (or another directory proven to be on the same filesystem), not in the operating system's general temporary directory. [POSIX `rename`](https://pubs.opengroup.org/onlinepubs/9799919799/functions/rename.html)

This is atomic **visibility for one directory entry**, not a transaction spanning several files and not automatically a durable commit. The portable design should consequently arrange each reader-visible decision behind one replaced file:

- an Entry's current representation is one complete encoded file;
- an immutable Entry revision is written before the current representation points to it;
- an asset blob is complete before its metadata or an Entry can reference it;
- optional derived indexes are caches rebuilt from authoritative records, not co-equal commit participants.

If a mutation must make several independent mutable files visible simultaneously, plain filesystem primitives are insufficient. Use an immutable generation plus a single manifest/head file as the commit point, or narrow the operation until one rename is enough. A failed mutation may leave unreachable immutable data, but it must not expose a half-committed record.

Windows exposes replacement through `MoveFileEx(..., MOVEFILE_REPLACE_EXISTING)`, but its documented flags and flush behavior differ from POSIX. The Layer should use Bun's `node:fs/promises.rename`, classify platform-specific errors, and prove its advertised behavior on every supported OS rather than claiming POSIX semantics everywhere. [Microsoft `MoveFileEx`](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-movefileexa), [Node.js `fsPromises.rename`](https://nodejs.org/api/fs.html#fspromisesrenameoldpath-newpath)

### Concurrency must be owned above the filesystem calls

Node's promise filesystem operations are explicitly not synchronized or threadsafe, and its documentation warns that concurrent modifications can corrupt data. The same reference says repeated `writeFile()` calls to one file are unsafe unless each promise settles first. Bun implements this `node:fs` surface, but no documented Bun or Node filesystem API supplies one cross-platform advisory-lock abstraction. [Node.js File system](https://nodejs.org/api/fs.html#promises-api), [Node.js `fsPromises.writeFile`](https://nodejs.org/api/fs.html#fspromiseswritefilefile-data-options)

Operating-system locks do not repair that portability gap. Linux `flock` is advisory, has platform-dependent interaction with other lock types, and changes behavior over NFS and SMB; Windows has a separate byte-range `LockFileEx` facility. [Linux `flock(2)`](https://man7.org/linux/man-pages/man2/flock.2.html), [Microsoft `LockFileEx`](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-lockfileex)

The v0.1 contract should therefore be:

1. one initialized writer process owns a storage root;
2. the Layer serializes all mutations that may touch the same commit unit (a single global mutation queue is acceptable before profiling proves a need for finer-grained locks);
3. concurrent readers observe only committed files;
4. optimistic write tokens are checked while holding that in-process serialization boundary;
5. a second writer process is unsupported, not silently "best effort."

`open(path, "wx")` is still useful for race-free creation of unique staging files and immutable objects. The exclusive flag fails when a path already exists and, on POSIX, does not follow a final symlink, but Node warns that exclusive creation may not work on network filesystems. It is a creation primitive, not a durable distributed lock. [Node.js filesystem flags](https://nodejs.org/api/fs.html#file-system-flags)

### Crash consistency and durability are separate promises

A close or successful rename does not by itself promise survival after power loss. Node documents `FileHandle.sync()` as requesting that all data for an open descriptor reach the storage device, with details dependent on the OS and device. On Linux, `fsync` flushes file data and metadata but does not necessarily persist the containing directory entry; the directory itself must also be synchronized. [Node.js `FileHandle.sync()`](https://nodejs.org/api/fs.html#filehandlesync), [Linux `fsync(2)`](https://man7.org/linux/man-pages/man2/fsync.2.html)

The Layer should expose two truthful modes rather than blur these guarantees:

- **atomic**: write and close a unique sibling temporary, then rename it into place. Readers never receive deliberately partial data after a process crash, but a machine crash may lose the latest acknowledged mutation.
- **durable**: write the temporary through an owned `FileHandle`, `sync()` it, close it, rename it, and synchronize the parent directory where the target platform/filesystem supports that operation. Initialization should probe required capabilities and reject durable mode if they are unavailable; silently degrading would make acknowledgement semantics false.

For either mode, every staged file needs a recognizable reserved name and a fully validated payload. On startup, recovery should:

1. ignore staging files when serving reads;
2. validate all authoritative files before accepting the root;
3. remove only abandoned files matching the Layer's exact staging convention;
4. retain and report corrupt committed files rather than deleting evidence;
5. rebuild disposable indexes from authoritative Entries and asset metadata.

The commit sequence must be idempotent. A crash before rename leaves an orphan staging file; a crash after rename leaves the old or new complete file visible. Immutable revision and asset writes should tolerate an already-existing identical digest and reject a collision whose bytes differ.

### Path safety requires generated names and an owned root

`node:path` behavior differs between Windows and POSIX, and Node explicitly says `path.isAbsolute()` is not safe for mitigating traversal. Bun also documents a check-then-open race for `BunFile.exists()` and recommends attempting the operation and handling the error instead. [Node.js Path](https://nodejs.org/api/path.html), [Bun `BunFile.exists`](https://bun.com/reference/bun/BunFile/exists)

Lexically resolving a user path under a root is not sufficient against symlinks. Even the POSIX `O_NOFOLLOW` flag rejects a symlink only in the final path component; earlier components are still followed. Node exposes the flag, but it does not expose Linux's stronger `openat2` resolution policy as a portable API. [Linux `open(2)`](https://man7.org/linux/man-pages/man2/open.2.html), [Node.js filesystem constants](https://nodejs.org/api/fs.html#file-system-constants)

Accordingly:

- never derive a physical path from a Content Type name, slug, original upload filename, MIME type, URL path, or arbitrary Entry field;
- map validated internal identifiers to a conservative generated alphabet such as lowercase hex, with fixed extensions and bounded component lengths;
- retain original filenames only as encoded metadata;
- reject separators, dot segments, NUL, absolute/drive/UNC forms, case aliases, and reserved staging prefixes at every identifier boundary;
- store paths relative to the configured root so a repository can move between machines;
- create and permission the root outside user-writable directory trees, then refuse symlinks or unexpected file types discovered by `lstat` during initialization and scans.

These measures protect against remote CMS input. They do not make the Layer secure when an untrusted local process can concurrently rewrite intermediate directories. The root's exclusive local ownership is therefore part of the security contract, not merely deployment advice.

### Stream assets; keep logical metadata explicit

`BunFile` is a lazy `Blob` and can produce a `ReadableStream`, so asset reads need not buffer the whole object. `FileSink` supports incremental writes and configurable buffering; pending writes and `end()` must be awaited. [Bun Binary Data](https://bun.com/docs/runtime/binary-data), [Bun File I/O](https://bun.com/docs/runtime/file-io)

Asset ingestion should stream once into an exclusive staging file while computing a cryptographic digest and enforcing byte limits, then sync/close and publish to a digest-derived immutable path. This gives stable deduplication and integrity without trusting a client filename. Entry JSON is normally small enough to encode as one bounded value, but it should still go through the same staged publication primitive.

Filesystem metadata is useful operational evidence, not CMS domain data. Node says timestamp precision is platform-specific, and Bun infers a `BunFile` MIME type from the extension. Therefore, `createdAt`, `updatedAt`, write revision, original filename, declared/detected media type, byte length, checksum, and any image dimensions should live in validated CMS metadata. Do not use `mtime` as an optimistic-concurrency token, `birthtime` as logical creation time, inode as an ID, or extension-derived MIME as proof of content type. `stat()` size may be used as a consistency check. [Node.js stat time values](https://nodejs.org/api/fs.html#stat-time-values), [Bun `Bun.file` reference](https://bun.com/reference/bun/file)

### Watchers are hints, never the source of truth

Bun exposes `fs.watch`, but Node documents that watcher behavior is inconsistent across platforms; events can be unavailable on NFS, SMB, and virtualized host filesystems, filenames may be absent, and Linux/macOS watch an inode that is not replaced when an atomic rename creates a new inode at the same path. [Bun: Watch a directory](https://bun.com/docs/guides/read-file/watch), [Node.js `fs.watch` caveats](https://nodejs.org/api/fs.html#caveats)

Consequently, the Layer must not use watchers to establish correctness, detect every write, coordinate writers, or drive revision creation. A watcher may invalidate a cache or trigger a debounced full rescan. Watch the containing directory rather than individual record files, tolerate duplicate/missing/coalesced events, and always re-read and validate authoritative state. Internal writes can invalidate their own caches directly.

### Portability is a tested support matrix, not a property of JSON files

The portable baseline should target Bun on local filesystems for macOS, Linux, and Windows, using conservative generated filenames and same-directory staging. The Layer must not rely on POSIX permission modes, case sensitivity, inode identity, nanosecond timestamps, atomic replacement across volumes, advisory-lock behavior, or watcher completeness. Network shares, FUSE/provider-synchronized folders, and multiple hosts mounting one root should be documented as unsupported unless a dedicated adapter proves stronger semantics. Bun reports high but not perfect Node filesystem compatibility, reinforcing the need for target-runtime tests. [Bun Node.js compatibility](https://bun.com/docs/runtime/nodejs-compat), [Node.js Path: Windows versus POSIX](https://nodejs.org/api/path.html#windows-vs-posix)

At Layer initialization, validate or probe what can be checked cheaply: root type and ownership expectations, ability to create exclusively, sibling rename/replace, cleanup, and (for durable mode) file and directory synchronization. Preserve structured filesystem error codes so callers can distinguish conflict, unsupported capability, permission, exhaustion, corruption, and transient I/O failure.

## Required test strategy

The implementation should keep layout/encoding/transaction decisions separate from the small filesystem-operation boundary, then test both levels:

- **Model and fault-injection tests:** substitute deterministic filesystem operations and inject failure before/after create, each write, file sync, close, rename, directory sync, and cleanup. Assert that recovery exposes the old or new complete value, never a partial value.
- **Real temporary-directory tests:** use a fresh `mkdtemp` root per test and exercise actual Bun `node:fs` plus `Bun.file` streaming. Verify truncation hazards, cleanup, unexpected file types, symlinks, Unicode and case collisions, and structured errors.
- **Concurrency tests:** race many in-process creates/updates and assert optimistic conflicts and valid revision chains. A separate negative characterization test may show why two uncoordinated writer processes are unsupported; it must not turn their nondeterministic outcome into a promised arbitration mechanism.
- **Streaming tests:** upload assets larger than the configured buffer, introduce a deliberately slow source, cancel midway, and assert bounded memory, awaited backpressure, no published partial, and eventual staging cleanup.
- **Recovery tests:** kill a child process at named commit failpoints, restart against the same root, and assert deterministic recovery. These test the recovery protocol; they cannot by themselves prove power-loss durability.
- **Platform CI:** run the filesystem suite on supported macOS, Linux, and Windows Bun versions. Keep remote/network filesystems out of the support claim unless separate CI covers their exact mount and server semantics.

## Decisions this research supports

1. The v0.1 Bun filesystem Layers support one writer process per owned local storage root; concurrent reads and in-process mutations are supported.
2. All mutable Entries and metadata use exclusive sibling staging plus one rename commit point. Assets and revisions are immutable once published; derived indexes are rebuildable.
3. Durability is an explicit `atomic` versus `durable` policy. `FileSink.flush()` is never presented as `fsync`, and durable mode fails initialization when its required sync operations cannot be provided.
4. Physical names come only from validated internal IDs or digests. User filenames and MIME information are metadata, and the root is not a security boundary against hostile local filesystem mutation.
5. Asset reads and writes are streaming and backpressure-aware. Logical timestamps, revisions, hashes, and media metadata are stored explicitly rather than inferred from filesystem metadata.
6. Watchers are optional cache-invalidation hints with rescan fallback; they are never part of persistence correctness.
7. The support claim is Bun on tested local macOS, Linux, and Windows filesystems. Multi-process writers, NFS/SMB, synchronized folders, FUSE, and shared multi-host roots require another adapter or a later, separately researched capability.

## Follow-on decisions

This research deliberately does not choose the on-disk directory layout, Entry encoding, revision-retention format, or the exact Effect service interface. Those decisions should preserve the constraints above. In particular, the storage-layout decision must identify the single reader-visible commit point for Entry updates, relationship changes, revisions, asset metadata, and definition migrations rather than assuming several renames form one transaction.
