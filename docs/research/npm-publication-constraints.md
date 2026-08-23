# npm publication constraints for the Bun monorepo

_Researched 2026-08-22 against the current official Bun, npm, TypeScript, and Effect sources._

> **Update, 2026-08-23:** The final package contract replaces this note's `npm pack` recommendation with one authoritative `bun pm pack` archive that is inspected, smoke-tested, and then passed directly to `npm publish`. See [`bun-pm-pack-release-gates.md`](./bun-pm-pack-release-gates.md) and [`package-release-readiness-decision.md`](../package-release-readiness-decision.md). npm remains the registry client for trusted publication.

## Answer

Nearly Headless CMS can be developed as a Bun monorepo and published as a conventional typed ESM package. The safest v0.1 route is:

- make the repository root and both example applications private Bun workspaces;
- keep exactly one independently publishable library workspace for v0.1;
- publish compiled ESM JavaScript, declarations, declaration maps, and source maps from `dist/`;
- expose only deliberate public entry points through `exports`, with the `types` condition first;
- make `effect` a required peer dependency and a development dependency, while keeping TypeScript and build tools development-only;
- use Bun for installation, scripts, linting, tests, and local execution, but use the npm CLI for the registry upload so npm trusted publishing can perform its documented OIDC exchange;
- make package inspection and tarball smoke tests release gates; and
- perform no registry write until a human intentionally invokes the release workflow.

The current repository is not yet publish-ready. Its root is still a single package rather than a private workspace root, it has no `version` or license metadata, it points `module` at the source `index.ts`, and it has no declaration or JavaScript build. Those are implementation tasks, not reasons to change the route above.

## Monorepo boundary

Use a layout equivalent to:

```text
package.json                         # private workspace root
packages/nearly-headless-cms/       # the only publishable v0.1 package
apps/example-cms/                    # private
apps/public-blog/                    # private
```

The root package should set `"private": true` and declare `"workspaces": ["packages/*", "apps/*"]`. Each application should also set `"private": true`; only the library workspace omits it. npm refuses to publish a package whose manifest has `private: true`, and Bun supports npm-style workspace globs and package-local manifests. [npm package metadata: `private` and `workspaces`](https://docs.npmjs.com/cli/v12/configuring-npm/package-json/#private), [Bun workspaces](https://bun.sh/docs/pm/workspaces)

Every workspace must declare the dependencies it actually imports. Hoisting is an installation optimization, not permission for a package to rely on a dependency declared only at the root. Bun explicitly describes workspace packages as separately named packages and may hoist shared dependencies; testing the packed library in a clean consumer is therefore necessary to catch accidental reliance on the monorepo installation. [Bun workspaces](https://bun.sh/docs/pm/workspaces)

Private example applications may depend on the library using `workspace:*`. Bun rewrites workspace protocol versions when it publishes, but the selected release path below uses npm's CLI for OIDC. The v0.1 publishable package should therefore have no outbound `workspace:*`, `file:`, or other local-path dependency. If a later version introduces multiple public packages, give their inter-package dependencies real release versions or introduce and test an explicit manifest-staging process. Bun documents its workspace rewrite, while npm warns that local-path dependencies should not be used in a public package. [Bun workspace publication](https://bun.sh/docs/pm/workspaces#workspaces), [npm dependency metadata](https://docs.npmjs.com/cli/v12/configuring-npm/package-json/#local-paths)

## Publishable manifest

The library workspace should converge on this shape. The license placeholder is intentional because the repository does not yet contain a license decision or `LICENSE` file.

```json
{
  "name": "nearly-headless-cms",
  "version": "0.1.0",
  "description": "A library for building headless CMS applications with Effect",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "default": "./dist/index.js"
    },
    "./package.json": "./package.json"
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],
  "license": "<SPDX identifier>",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/jeremyc2/nearly-headless-cms.git",
    "directory": "packages/nearly-headless-cms"
  },
  "bugs": {
    "url": "https://github.com/jeremyc2/nearly-headless-cms/issues"
  },
  "homepage": "https://github.com/jeremyc2/nearly-headless-cms#readme",
  "publishConfig": {
    "access": "public",
    "registry": "https://registry.npmjs.org/",
    "provenance": true
  },
  "peerDependencies": {
    "effect": "^4.0.0-rc.111"
  },
  "devDependencies": {
    "effect": "4.0.0-rc.111",
    "typescript": "7.0.2"
  }
}
```

This is a target shape, not a mandate to expose only one entry point forever. Add each stable subpath explicitly as it becomes part of the public API. An `exports` map encapsulates everything not named in it, and TypeScript resolves an explicit `types` condition. Keep `types` before runtime conditions because conditional exports are checked in object order. Retaining a top-level `types` field is still recommended by TypeScript even when `exports` can resolve declarations. [npm `exports`](https://docs.npmjs.com/cli/v12/configuring-npm/package-json/#exports), [TypeScript package resolution](https://www.typescriptlang.org/docs/handbook/modules/reference.html#packagejson-exports), [TypeScript declaration publishing](https://www.typescriptlang.org/docs/handbook/declaration-files/publishing.html)

Do not expose `src/*`, `dist/*`, or an unrestricted wildcard merely for convenience. Adding `exports` blocks unlisted deep imports, so it becomes the enforceable public API boundary. The current Effect package uses the same broad pattern of source exports during development and `dist` exports for publication, but Nearly Headless CMS does not need Effect's very large wildcard surface. [TypeScript package resolution](https://www.typescriptlang.org/docs/handbook/modules/reference.html#example-exports-block-other-subpaths), [Effect v4 package manifest](https://github.com/Effect-TS/effect/blob/main/packages/effect/package.json)

Use `files` as an allowlist rather than maintaining `.npmignore`. npm otherwise defaults to including nearly everything. npm always includes the package manifest, README, and license, but a workspace package needs its own publish-facing README and license because files outside that workspace are not part of its package directory. The tarball should contain only the manifest, documentation/license, and the declared `dist` outputs—never tests, fixtures, application code, credentials, or repository configuration. [npm `files`](https://docs.npmjs.com/cli/v12/configuring-npm/package-json/#files)

Do not set a permanent prerelease `tag` in `publishConfig`. A final `0.1.0` should receive the default `latest` tag; any prerelease should have a prerelease version and pass `--tag next` intentionally. `access: public` is required for a scoped public package and harmlessly documents intent for an unscoped one; an explicit registry prevents a developer's local scope configuration from redirecting a release. npm documents `access`, `tag`, and `registry` as publish-time configuration. [npm `publishConfig`](https://docs.npmjs.com/cli/v12/configuring-npm/package-json/#publishconfig), [publishing scoped public packages](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/)

`sideEffects: false` may be added only after the public modules are verified to have no import-time side effects. It is an optimization claim, not generic metadata.

## JavaScript and declaration build

Prefer a TypeScript build for the public package rather than making raw TypeScript its primary npm entry. Bun can execute a `bun` export condition that targets source `.ts`, but compiled ESM plus declarations remains consumable by Bun and does not make every consumer's runtime responsible for TypeScript transpilation. Bun supports standard ESM and resolves `exports`; TypeScript recommends compiling libraries under a strict Node-compatible module mode because output that follows Node's stricter rules generally also works in bundlers. [Bun package resolution](https://bun.sh/docs/runtime/module-resolution#shipping-typescript), [TypeScript library compiler options](https://www.typescriptlang.org/docs/handbook/modules/guides/choosing-compiler-options.html#im-writing-a-library)

Create a package build configuration with these material differences from the current root app-oriented `tsconfig.json`:

```jsonc
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "module": "node18",
    "target": "ES2022",
    "noEmit": false,
    "noEmitOnError": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "rewriteRelativeImportExtensions": true,
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*.ts"]
}
```

The actual `target` is the lowest runtime level v0.1 promises; `ES2022` is a reasonable starting choice, not a researched product requirement. TypeScript's current library guidance calls for `module: node18`, declarations, source/declaration maps, and explicit `rootDir`/`outDir`. `rewriteRelativeImportExtensions` permits Bun-friendly `.ts` relative imports in source while producing runnable `.js` specifiers in emitted output. [TypeScript library compiler options](https://www.typescriptlang.org/docs/handbook/modules/guides/choosing-compiler-options.html#im-writing-a-library), [TypeScript `rewriteRelativeImportExtensions`](https://www.typescriptlang.org/tsconfig/rewriteRelativeImportExtensions.html)

Run this through Bun, for example `bunx tsc -b tsconfig.build.json`. Project references and `composite` are optional at this size, but become useful if public packages later depend on one another; TypeScript build mode orders referenced builds and referenced projects emit declarations. [TypeScript project references](https://www.typescriptlang.org/docs/handbook/project-references)

Expected artifacts for every exported module are:

- `.js` runtime code;
- `.d.ts` declarations;
- `.js.map` source maps; and
- `.d.ts.map` declaration maps.

The current Effect v4 source is a useful compatibility precedent: its package compiler configuration uses NodeNext, an ES2022 target, TypeScript extension rewriting, declarations, and both map types; its publishable manifests allowlist `dist/**/*.js`, `dist/**/*.d.ts`, and their maps. [Effect compiler configuration](https://github.com/Effect-TS/effect/blob/main/tsconfig.base.json), [Effect package manifest](https://github.com/Effect-TS/effect/blob/main/packages/effect/package.json)

If implementation instead chooses `bun build`, remember that Bun bundles package dependencies by default. Use `--packages external` (or an equivalent explicit external list) so `effect` and every other runtime dependency remain external, and run TypeScript separately with `emitDeclarationOnly` because Bun's bundler output is JavaScript, not the package's declaration contract. [Bun bundler dependency handling](https://bun.sh/docs/bundler#packages), [TypeScript `emitDeclarationOnly`](https://www.typescriptlang.org/tsconfig/emitDeclarationOnly.html)

Do not promise CommonJS in v0.1 unless there is a tested second JavaScript build and matching declaration graph. TypeScript warns that ESM and CommonJS entry points need module-appropriate declarations; an ESM-only `type: module` package avoids that dual-package surface. [TypeScript package entry points](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-7.html#packagejson-exports-imports-and-self-referencing)

## Dependency placement

`effect` should be a required peer dependency and also a development dependency of the library workspace. Nearly Headless CMS exposes and composes Effect services, so it must interoperate with the CMS Builder's Effect installation rather than silently install a second host copy. npm defines peer dependencies for compatibility with a host library, and Effect's current Bun platform package follows exactly this pattern: `effect` is a peer plus a development dependency. [npm peer dependencies](https://docs.npmjs.com/cli/v12/configuring-npm/package-json/#peerdependencies), [Effect Bun platform manifest](https://github.com/Effect-TS/effect/blob/main/packages/platform/bun/package.json)

For the present RC line, `^4.0.0-rc.111` matches Effect's own published `@effect/platform-bun@4.0.0-rc.111` peer range. Keep the lockfile and development dependency on the exact tested RC so CI is reproducible, and update the peer floor only after compatibility tests pass against a newer RC. Effect v4 documents that its separately published packages must be kept on matching v4 versions. [Effect v4 migration guide](https://github.com/Effect-TS/effect/blob/main/MIGRATION.md), [published `@effect/platform-bun` metadata](https://registry.npmjs.org/@effect%2fplatform-bun/4.0.0-rc.111)

TypeScript is a build dependency, not a consumer peer, unless the library eventually calls the TypeScript compiler API at runtime. Generated declarations belong in the package; consumers should not have to compile package source. Runtime libraries imported by emitted JavaScript belong in `dependencies`, while lint, test, declaration, and build tools belong in `devDependencies`. npm separates consumer dependencies from development-only tooling on that basis. [npm dependency metadata](https://docs.npmjs.com/cli/v12/configuring-npm/package-json/#devdependencies), [TypeScript declaration publishing](https://www.typescriptlang.org/docs/handbook/declaration-files/publishing.html)

Keep Bun-specific dependencies (`@effect/platform-bun`, `@types/bun`, filesystem adapters) in the private Example CMS workspace unless the public package deliberately ships a Bun adapter. If such an adapter becomes public, it must have an explicit export or its own package, declare every runtime dependency itself, and avoid leaking Bun-only types from the runtime-neutral core declarations. The current Effect packages keep `@effect/platform-bun` separate from `effect`, which supports this boundary. [Effect Bun platform manifest](https://github.com/Effect-TS/effect/blob/main/packages/platform/bun/package.json)

## Scripts and package checks

The publishable workspace should expose an intentional script surface equivalent to:

```json
{
  "scripts": {
    "build": "tsc -b tsconfig.build.json",
    "typecheck": "tsc -b tsconfig.json",
    "verify": "bun run lint && bun run typecheck && bun test",
    "package:inspect": "npm pack --dry-run --json",
    "publish:dry-run": "npm publish --dry-run",
    "prepack": "bun run build",
    "prepublishOnly": "bun run verify",
    "release:npm": "npm publish"
  }
}
```

The exact lint/typecheck commands should use the repository's eventual package scripts and oxlint rules. The important lifecycle choices are:

- `prepack` builds because it runs for both `npm pack` and `npm publish`;
- `prepublishOnly` runs the final checks only for a real or dry-run publish;
- `npm pack --dry-run --json` gives a machine-readable tarball manifest without producing a release; and
- `npm publish --dry-run` simulates the selected publish path without writing a version.

npm documents those lifecycle boundaries and both dry-run commands. Bun also offers `bun publish --dry-run`, but using npm's dry run exercises the same client selected for trusted publication. [npm lifecycle scripts](https://docs.npmjs.com/cli/v12/using-npm/scripts/#life-cycle-scripts), [npm pack](https://docs.npmjs.com/cli/v12/commands/npm-pack/), [npm publish](https://docs.npmjs.com/cli/v12/commands/npm-publish/), [Bun publish](https://bun.sh/docs/pm/cli/publish#--dry-run)

Add a repository-owned `package:smoke` script before release. It should create an actual tarball in a temporary directory, install that tarball into a clean temporary consumer together with the supported `effect` version, typecheck a consumer import, execute every documented entry point, and assert the tarball allowlist. This is what catches missing declarations, incorrect export targets, hoisted undeclared dependencies, and packages that work only through workspace symlinks. Run it for every runtime the package claims to support; if v0.1 promises Bun only, test Bun only and say so in package documentation.

The root may proxy these commands with a Bun workspace filter, but the publish command must select exactly the library workspace. Never use an unqualified `--workspaces` publish in this repository.

## Provenance-ready release path

Use GitHub Actions on a GitHub-hosted runner with `contents: read` and `id-token: write`. Install dependencies with the pinned Bun version and `bun install --frozen-lockfile`; run all checks and package smoke tests; then set up Node 24 with npm 11.5.1 or later and run `npm publish` from only the library workspace. npm's current trusted-publisher documentation requires npm 11.5.1+, Node 22.14+, a cloud-hosted runner, and the OIDC permission. It automatically generates provenance for a trusted publish from a public repository to a public package. [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/)

The package `repository.url` must exactly match the public GitHub repository for provenance, and a monorepo package should additionally set `repository.directory`. This repository is public and its canonical URL is `https://github.com/jeremyc2/nearly-headless-cms`; the manifest example above meets both requirements. [npm provenance prerequisites](https://docs.npmjs.com/generating-provenance-statements/#prerequisites), [npm monorepo repository metadata](https://docs.npmjs.com/cli/v12/configuring-npm/package-json/#repository)

There is one bootstrap caveat. npm requires a package to already exist before a trusted publisher can be configured. For the first `0.1.0` only, publish from the same GitHub-hosted workflow using a narrowly scoped npm token and `npm publish --provenance --access public`; then configure that workflow as the package's trusted publisher and revoke the token. Later releases use OIDC with no long-lived publish token, and provenance is automatic. [npm trust prerequisites](https://docs.npmjs.com/cli/v11/commands/npm-trust/#prerequisites), [npm provenance from GitHub Actions](https://docs.npmjs.com/generating-provenance-statements/#publishing-packages-with-provenance-via-github-actions)

`publishConfig.provenance: true` keeps provenance requested for the bootstrap/token route and is harmless once trusted publishing makes it automatic. Do not use `bun publish` for the trusted OIDC upload unless Bun later documents equivalent npm trusted-publisher authentication; Bun's current publish documentation describes token authentication, while npm documents its CLI as the component that detects OIDC and exchanges it for the short-lived registry credential. [Bun publish authentication](https://bun.sh/docs/pm/cli/publish#--otp), [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/#how-trusted-publishing-works)

No publish command was executed during this research.

## v0.1 release-readiness gate

The library is ready for an intentional `0.1.0` publish only when all of the following are true:

- [ ] The root and both example applications are `private`; only the library workspace is publishable.
- [ ] The final npm name and owner are confirmed immediately before release. `nearly-headless-cms` and `@jeremyc2/nearly-headless-cms` both returned registry `E404` on 2026-08-22, but that point-in-time result does not reserve either name.
- [ ] The library manifest says `version: 0.1.0`, has a real SPDX license, and a matching `LICENSE` file exists in the library workspace.
- [ ] The package README documents installation, supported runtimes, Effect v4 RC compatibility, every public import path, and the v0.1 stability policy.
- [ ] A clean `bun install --frozen-lockfile` succeeds from a fresh checkout.
- [ ] Lint, typecheck, and `bun test` pass without suppressing repository rules.
- [ ] A clean build produces JavaScript, declarations, source maps, and declaration maps for every export, with no stale files in `dist`.
- [ ] `npm pack --dry-run --json` lists only the intended package files and every manifest target exists in that list.
- [ ] A clean consumer can install the actual tarball, typecheck imports, and run them without monorepo symlinks or undeclared dependencies.
- [ ] `npm publish --dry-run` succeeds from the library workspace. A dry run is still not a substitute for reviewing the pack manifest.
- [ ] Package-name ownership, npm account 2FA, first-publish credentials, GitHub environment protection, and the exact release workflow filename are prepared.
- [ ] The release workflow uses a Git tag matching `v0.1.0`, a GitHub-hosted runner, `id-token: write`, the pinned Bun toolchain, Node 24, and a supported npm CLI.
- [ ] The human approves the first registry write. Until that explicit act, the repository remains publishable but unpublished, as intended.

## Decisions this research leaves to the specification

Packaging constraints do not decide these product questions:

- the final npm package name and scope;
- the open-source license;
- whether the public core promises Bun-only or broader JavaScript-runtime support;
- the exact stable public subpaths; and
- whether a future Bun adapter belongs under a subpath or in a second public package.

They must be fixed before implementation can finalize the manifest and acceptance matrix, but none requires changing the monorepo or publication route described here.
