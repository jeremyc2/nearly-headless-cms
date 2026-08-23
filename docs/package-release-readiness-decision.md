# npm Package and Release-Readiness Contract

## Decision

Nearly Headless CMS v0.1 ships as one public npm package named `nearly-headless-cms` from the `packages/nearly-headless-cms` workspace. The package is a typed, ESM-only library licensed under MIT. Its portable modules support Bun and Node, while its Bun Filesystem Persistence Layer is isolated behind an explicit Bun-only export. The private Example CMS and Public Blog are not published.

Release readiness means the repository can build, inspect, install, exercise, and dry-run the exact `0.1.0` artifact through the selected release workflow. It does not authorize or execute an npm publication.

## Package identity and metadata

The library manifest uses:

- npm name `nearly-headless-cms`;
- initial version `0.1.0`;
- description `A library for building headless CMS applications with Effect`;
- author `Jeremy Ryan Chandler`;
- SPDX license identifier `MIT`;
- keywords `headless-cms`, `cms`, `effect`, `typescript`, and `bun`;
- canonical repository, package-directory, bugs, and homepage links for `https://github.com/jeremyc2/nearly-headless-cms`;
- public npm access, the public npm registry, and provenance in `publishConfig`; and
- no initial `funding` or global `engines` field.

The runtime matrix is documented and verified per public entry point because a global engine declaration cannot accurately express portable modules alongside one Bun-only module. The npm name is rechecked immediately before the first release because a prior absence from the registry does not reserve it.

The repository and package workspace each contain the complete MIT license notice:

```text
Copyright (c) 2026 Jeremy Ryan Chandler
```

Verification keeps the two license texts identical.

## Runtime and dependency compatibility

Portable JavaScript targets ES2022 and supports Bun `>=1.4.0` and Node `>=22`. Verification covers Bun 1.4, the supported Node 22 line, and Node 24 used by the release workflow. `nearly-headless-cms/bun/filesystem` supports Bun only and must not leak Bun-only types or imports through any portable declaration or module.

The package requires `effect` as a peer dependency with range `^4.0.0-rc.111` and uses exact `effect@4.0.0-rc.111` as its development dependency. Every Effect version claimed by the peer range must pass compatibility verification; an incompatible peer-floor increase requires the next `0.y.0`. TypeScript 7 is a development dependency and the declaration-compatibility target, not a consumer peer dependency. Build, lint, and test tools remain development-only.

Every public module is free of import-time behavior. Importing the package never reads environment state, registers handlers, starts resources, or initializes mutable caches. Initialization occurs only when a CMS Builder constructs or runs an Effect Layer. Once verified, the manifest declares `sideEffects: false`.

## Public module interface

The `exports` map is the complete public module seam. It exposes only:

- `.`;
- `./http`;
- `./adapters`;
- `./bun/filesystem`;
- `./testing`; and
- `./package.json`.

Every runtime entry has its own `types`, `import`, and `default` target, with `types` first. The package also supplies conventional top-level `main` and `types` fields for the root. No default JavaScript export is defined: public runtime entry points use named, module-oriented exports. The package never exposes `src/*`, `dist/*`, unrestricted wildcards, or private implementation modules.

### Root module

`nearly-headless-cms` exposes these named modules:

- `Cms`;
- `ContentDefinition`;
- `Entry`;
- `EntryQuery`;
- `EntryHistory`;
- `Asset`;
- `RichText`;
- `DefinitionMigration`;
- `Operation`;
- `Identity`;
- `Authorization`;
- `Persistence`;
- `Identifier`;
- `Transport`; and
- `CmsError`.

These modules contain the public schemas, types, constructors, invariants, and Effect service and Layer interfaces needed by a CMS Builder. The root includes the one public CMS service and the required seams for the Definition Catalog, Entry persistence, Asset management, Current Identity, Authorization, identifier generation, and transport. `ContentDefinition` exposes deterministic Effect Schema compilation. Definition Registry caching, query planning, operation orchestration, and lifecycle machinery remain private implementation details.

### HTTP module

`nearly-headless-cms/http` exposes:

- `HttpTransport`, the configurable Effect Layer;
- `HttpContract`, the stable Management and Headless wire contracts; and
- `OpenApi`, deterministic OpenAPI document generation.

The HTTP Transport accepts an Effect HTTP-server Layer at its seam. Its public interface contains no `@effect/platform-bun` type and requires no particular server Adapter. Effect's internal `HttpApi` representation is an implementation detail rather than part of the package compatibility promise.

### Supplied Adapter modules

`nearly-headless-cms/adapters` exposes the portable `MemoryDefinitionCatalog`, `MemoryEntryPersistence`, `MemoryAssetManagement`, `AnonymousIdentity`, `AllowAllAuthorization`, and `CryptoIdentifierGenerator` modules.

`nearly-headless-cms/bun/filesystem` exposes one `BunFilesystemPersistence` module satisfying the Entry and Asset persistence interfaces under the settled Filesystem Persistence Layer contract.

`nearly-headless-cms/testing` exposes one `DevelopmentCms` module that composes the development Adapters. It does not become a miscellaneous test-utility package.

Every explicit export, including development and testing exports, receives the same package compatibility protection.

## Artifacts and archive contents

The package build emits unbundled ESM JavaScript, declarations, JavaScript source maps, and declaration maps for every exported module. Effect and other runtime dependencies remain external. Maps embed their source content so debugging does not require raw TypeScript in the archive.

The npm archive allowlist contains only:

- `package.json`;
- `README.md`;
- `LICENSE`;
- `CHANGELOG.md`;
- `dist/**/*.js`;
- `dist/**/*.d.ts`;
- `dist/**/*.js.map`; and
- `dist/**/*.d.ts.map`.

Tests, fixtures, applications, raw source, credentials, repository configuration, and build configuration are excluded.

Bun creates the one authoritative release candidate with `bun pm pack` from exactly the library workspace into a fresh temporary directory. A repository-owned Bun inspector reads the actual archive, validates every entry against the allowlist, rejects duplicate, absolute, parent-traversal, symlink, or unexpected entries, and emits a stable JSON report. Bun's human-readable dry-run output is not parsed as a substitute for archive inspection.

All clean-consumer and runtime smoke tests install that same archive. The protected publish job verifies its checksum after artifact transfer, runs `npm publish <tarball> --dry-run --json`, and finally runs `npm publish <tarball>` after approval. npm remains the authenticated registry client for trusted publishing, but it never repacks a different workspace state for release.

## Documentation contract

The package-local README documents:

- installation;
- a minimal CMS composition;
- every public import path and a concise example for each public module;
- the Bun and Node runtime matrix;
- the Bun-only Filesystem Persistence Layer distinction;
- ESM-only status;
- Effect and TypeScript compatibility;
- package stability and versioning; and
- links to the repository's architecture and reference-application documentation.

Every exported value, type, schema, invariant, failure mode, and important performance constraint has TSDoc. README examples are compiled and executed during verification. v0.1 does not require a generated documentation website.

`CHANGELOG.md` records every release and supplies migration instructions for every breaking package change. `docs/releasing.md` is the human release runbook.

## Versioning and compatibility

Published versions and tags are immutable. Tags use the exact `v<version>` form and the library manifest is the single authoritative version source.

Within a `0.y` line, patch releases preserve compatibility across explicit import paths, exported TypeScript interfaces, runtime behavior, errors, and serialized contracts. Patches contain compatible fixes and documentation improvements. New capabilities normally advance the next `0.y.0`; before 1.0, that release may make documented breaking changes with migration instructions. There is no guaranteed pre-1.0 deprecation window, although a practical deprecation should precede removal when it does not impose disproportionate complexity.

API Contract Versions, Content Definition versions, Field Kind versions, Rich Text format versions, and migration paths retain their independent compatibility rules. A package version change never silently rewrites one of those persisted or wire contracts.

Only the current `0.y` line is guaranteed active maintenance. Earlier lines remain installable but receive no general backport promise.

## Script contract

The library workspace provides these stable contributor and release scripts:

- `clean`;
- `build`;
- `lint`;
- `typecheck`;
- `test`;
- `verify`;
- `package:inspect`;
- `package:smoke`;
- `publish:dry-run`;
- `release:npm`;
- `prepack`; and
- `prepublishOnly`.

`verify` runs linting, type checking, and tests. `prepack` performs a clean deterministic build. `prepublishOnly` runs verification and package smoke checks as a local safety net. Release correctness never depends on implicit lifecycle execution: the protected workflow runs every gate explicitly against the candidate archive before approval.

`package:inspect` creates and validates the Bun archive and emits the JSON evidence. `package:smoke`, `publish:dry-run`, and `release:npm` consume that exact archive rather than silently creating another.

## Release-readiness gate

The protected publish job remains unavailable until all of these checks succeed:

1. A clean `bun install --frozen-lockfile`.
2. Package and repository linting, TypeScript checking, and `bun test` through declared scripts.
3. A clean deterministic package build.
4. Export-target, declaration, and `sideEffects: false` validation.
5. Verification that portable declarations and modules contain no Bun-only types or imports.
6. Inspection of the actual `bun pm pack` archive against the exact allowlist.
7. Clean-consumer installation and TypeScript 7 compilation for every documented import.
8. Portable-module runtime smoke tests on Bun 1.4, Node 22, and Node 24.
9. Filesystem Persistence Layer tests on macOS, Linux, and Windows.
10. Compilation and execution of every README example.
11. Manifest, license, changelog, repository, tag, clean-worktree, package-name, and unpublished-version checks.
12. `npm publish <tarball> --dry-run --json` using the same npm client and archive selected for publication.

The v0.1 acceptance strategy may add broader library and Example Blog verification, but it cannot weaken these package-specific gates.

## Release workflow and ownership

`.github/workflows/release-npm.yml` is triggered by a `v*` tag. It rejects a tag whose version does not exactly match the library manifest, whose commit is not on `main`, or whose repository state and generated artifacts do not pass verification.

The build job uses pinned Bun, creates the archive once, records its checksum and inspection report, and uploads it as a workflow artifact. The publish job downloads and verifies those artifacts, uses Node 24 and npm 11.5.1 or later, and targets the protected `npm` GitHub environment. A required human approval separates successful verification from the registry write. Job permissions are minimal: ordinary verification needs `contents: read`, trusted publication additionally needs `id-token: write`, and GitHub Release creation receives `contents: write` only after npm succeeds.

`jeremyc2` is the initial npm owner. The account uses mandatory two-factor authentication. Because npm requires an existing package before trusted publishing can be configured, the first `0.1.0` release uses one narrowly scoped token stored in the protected environment and requests provenance from the same workflow. Immediately afterward, the owner configures that exact workflow as the trusted publisher and revokes the token. Later releases use npm's OIDC exchange without a long-lived publication token.

After npm publication succeeds, the workflow creates the matching GitHub Release from the changelog. The runbook requires verification of registry metadata, provenance, archive integrity, and installation before declaring the release complete.

No publish command is executed while producing this specification.

## Faulty release policy

A defective published version is never overwritten, reused, or retagged. Maintainers deprecate it on npm, correct the `latest` distribution tag when necessary, and publish a new patch or minor version. Unpublishing is reserved for an exceptional security or legal reason consistent with npm policy.

## Consequences

- CMS Builders receive a deliberate, portable interface while Bun-specific behavior remains explicit and optional.
- The package's public interface is substantially smaller than its implementation, keeping internal orchestration replaceable.
- The release uploads the same bytes that verification inspected and exercised.
- Supporting Node as well as Bun increases compatibility testing but validates that the portable seams are genuine.
- Every exported development convenience becomes a maintained compatibility commitment, discouraging miscellaneous public utilities.
- A first-release token remains an unavoidable bootstrap exception, but it is bounded by the protected workflow, provenance, minimal scope, and immediate revocation.
