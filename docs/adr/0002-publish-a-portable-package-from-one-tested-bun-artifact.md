# Publish a portable package from one tested Bun artifact

Nearly Headless CMS publishes one ESM package whose portable modules support Bun and Node while its Filesystem Persistence Layer is isolated behind an explicit Bun-only export. Bun builds one authoritative npm tarball that is inspected and exercised before the npm CLI dry-runs and uploads those exact bytes, preserving Bun as the project toolchain while retaining npm trusted publishing and preventing verification-to-publication drift.

## Consequences

- Platform-specific types cannot leak through the portable interface.
- The package must verify both Bun and Node consumers and the Bun filesystem Adapter across its supported operating systems.
- Archive inspection needs a repository-owned JSON reporter because `bun pm pack` has no JSON manifest mode.
- The protected workflow cannot rely on publish lifecycle hooks to recreate or revalidate a prebuilt archive.

## Alternatives considered

- **Make the whole package Bun-only**: simpler compatibility testing, but contradicts the CMS Builder runtime seam and makes portable contracts unnecessarily platform-specific.
- **Keep the Filesystem Persistence Layer private to the Example CMS**: preserves a portable package, but withholds the settled reference Adapter from CMS Builders.
- **Let npm repack the workspace at publication time**: follows npm's default path, but can upload bytes different from the archive that clean consumers exercised.
