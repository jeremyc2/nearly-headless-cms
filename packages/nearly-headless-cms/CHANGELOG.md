# Changelog

All notable package changes are recorded here. Published versions and `v<version>` tags are immutable.

## Unreleased

- Adds queryable `Persistence.EntryReader`, atomic row-level `Persistence.EntryWriter`, and optional `Persistence.EntryHistory` capabilities alongside the generation compatibility seam.
- Adds `Asset.Catalog` and `Asset.Transfer` capabilities with direct-stream, presigned-URL, and redirect intents; management HTTP accepts presigned-upload metadata as JSON and follows redirect download intents with `303`.
- Adds `Cms.makeCapabilityLayer` for capability-native compositions while preserving `Cms.makeLayer` for existing adapters.
- Adds `RoleBasedAuthorization` and bearer-verifier `ClaimsIdentity` adapters.

## 1.0.0 — 2026-08-26

First stable public release.

- Stabilizes the public module surface: `.`, `./http`, `./adapters`, `./layers`, `./testing`, `./bun/filesystem`, and `./bun/http`.
- Adds `./layers` with pre-composed in-memory Layers for faster onboarding.
- Preserves documented import paths, serialized formats, HTTP contracts, and error codes within the `1.x` line.
- Requires Effect `^4.0.0-rc.111` as a peer dependency; portable modules support Bun 1.4+ and Node.js 22+.

### Migration from 0.1.0

- Replace direct Adapter composition with `nearly-headless-cms/layers` when a bundled in-memory stack is sufficient.
- Headless wire responses now emit explicit `null` for missing nullable fields instead of omitting the key.

## 0.1.0 — 2026-08-23

- Introduces the one public `Cms.Service` and the serializable Content Definition lifecycle.
- Adds portable Entry, Query, Relationship, Rich Text, Asset, History, and Definition Migration contracts.
- Adds the Management and Headless HTTP/OpenAPI contract boundary.
- Adds portable memory/development Adapters and the explicit Bun-only Filesystem Persistence Layer.

This is the initial compatibility baseline; no migration from an earlier release is required.
