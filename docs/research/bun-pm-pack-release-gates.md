# `bun pm pack` in the npm release gate

_Researched 2026-08-23 against Bun 1.4.0, npm 11.13.0, and the current official Bun and npm documentation._

## Answer

`bun pm pack` should replace `npm pack` for the gate that creates and smoke-tests the release tarball. It is a real npm-package packer, not merely a preview command: Bun documents that it creates a `.tgz` for the current workspace using the same inclusion rules as `npm pack`, and it supports `--dry-run`, an explicit destination or filename, lifecycle suppression, and a quiet filename-only mode. [`bun pm pack`](https://bun.com/docs/pm/cli/pm)

It is not a command-for-command replacement for `npm pack --dry-run --json`. Bun 1.4.0 has no documented JSON output for `pm pack`; `--quiet` returns only the archive name and therefore cannot provide the structured file manifest, sizes, modes, checksum, and integrity that npm returns under `--json`. npm also has broader package and workspace selection options. [`bun pm pack`](https://bun.com/docs/pm/cli/pm), [`npm pack`](https://docs.npmjs.com/cli/v11/commands/npm-pack/)

The release contract should therefore use one actual Bun-created tarball as the source of truth:

1. Run `bun pm pack` from the library workspace into a fresh temporary directory.
2. Have a repository-owned Bun script read the actual archive, compare its entries with the exact allowlist, and reject duplicate, absolute, parent-traversal, symlink, or unexpected entries.
3. Install and exercise that same archive in clean TypeScript/Bun/Node consumers.
4. Run `npm publish <archive> --dry-run --json` as the registry-client gate.
5. After approval, run `npm publish <archive>` so the tested bytes, rather than a newly repacked directory, are uploaded.

This preserves Bun as the package builder while retaining npm for the part that specifically needs the selected registry client and trusted-publishing flow. npm accepts a tarball file as a publishable package specification, and trusted publishing is performed by the npm CLI exchanging the workflow's OIDC identity for a short-lived registry credential. [`npm publish`](https://docs.npmjs.com/cli/v11/commands/npm-publish/), [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/)

## Capability comparison

| Capability | Bun 1.4.0 `bun pm pack` | npm 11 `npm pack` | Release consequence |
| --- | --- | --- | --- |
| Create an actual tarball | Yes; creates a `.tgz` and supports `--destination`, `--filename`, and configurable gzip level. | Yes; creates a `.tgz` and supports `--pack-destination`. | Use Bun to create the candidate artifact. |
| Preview without writing | `--dry-run` performs packing work and lists inclusions without writing the archive. | `--dry-run` reports the result without retaining the archive. | Bun dry-run is useful to humans, but inspecting the real archive is the stronger gate. |
| Machine-readable output | No documented JSON mode. `--quiet` emits only the filename. | `--json` returns package identity, filename, archive and unpacked sizes, checksum, integrity, and a per-file manifest. | Do not parse Bun's human output. Inspect the actual tar archive with a repository-owned script. |
| Pack lifecycles | Runs `prepack`, `prepare`, then `postpack`; `--ignore-scripts` skips them. | Runs `prepack`, `prepare`, then `postpack`; `--ignore-scripts` skips them. | Keep `prepack` deterministic. Run verification explicitly before packing rather than relying on `prepublishOnly`. |
| Package selection | Packs the current workspace. Bun 1.4.0's help exposes no package-spec, `--workspace`, `--workspaces`, or `--filter` option for this command. | Accepts a package specification and supports one, several, or all configured workspaces. | Select the library with its working directory, for example `bun --cwd=<library-workspace> pm pack ...`. |
| File inclusion | Bun says it follows `npm pack` rules. The `files` allowlist and ignore rules determine archive contents. | The `files` field is the package allowlist, with npm's documented always-included and always-excluded files. | Keep the manifest `files` allowlist and still assert the resulting archive entry by entry. |
| `exports` handling | Preserved in the packed `package.json`, but it is not the archive allowlist. | `exports` defines public module entry points and encapsulates unlisted imports; it does not replace `files`. | Validate both independently: archive contents against `files`, and public resolution against `exports`. |

Sources for the npm lifecycle and manifest distinctions: [npm lifecycle scripts](https://docs.npmjs.com/cli/v11/using-npm/scripts/), [npm `package.json` fields](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/).

## Bun 1.4.0 characterization

The installed CLI reported:

```text
$ bun --version
1.4.0

$ bun pm pack --help
bun pm pack  create a tarball of the current workspace
├ --dry-run
├ --destination
├ --filename
├ --ignore-scripts
├ --gzip-level
└ --quiet
```

A disposable package contained an allowlisted `dist/index.js`, an allowlisted but unexported `dist/internal.js`, and a non-allowlisted `secret.txt`. Its scripts printed their lifecycle names. Both normal and dry-run packing executed:

```text
prepack
prepare
postpack
```

`prepublishOnly` did not execute, matching npm's distinction between packing and publishing. The actual Bun archive contained exactly:

```text
package/package.json
package/README.md
package/dist/index.js
package/dist/internal.js
```

This confirms three points relevant to the gate: Bun 1.4.0 creates a conventional `package/`-rooted npm tarball; its dry run still executes pack lifecycle scripts unless `--ignore-scripts` is supplied; and `exports` does not remove an otherwise allowlisted internal file. npm documents the same `prepack`/`prepare`/`postpack` sequence and defines `exports` as an import-resolution boundary rather than a package-content list. [npm lifecycle order](https://docs.npmjs.com/cli/v11/using-npm/scripts/#life-cycle-operation-order), [npm `files`](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#files), [npm `exports`](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#exports)

The same fixture also demonstrated why Bun's quiet mode is insufficient for inspection. `bun pm pack --dry-run --quiet` printed the tarball name, but lifecycle output surrounded it unless scripts were ignored, and even with scripts ignored it provided no per-file metadata. By contrast, `npm pack --dry-run --json` returned a structured `files` array plus archive metadata. The installed CLIs' documented options match the official command references. [`bun pm pack` output modes](https://bun.com/docs/pm/cli/pm#output-modes), [`npm pack` JSON option](https://docs.npmjs.com/cli/v11/commands/npm-pack/#json)

## Lifecycle placement

The package scripts should not make correctness depend on the registry command implicitly rerunning work:

- `prepack` may perform the clean deterministic build because Bun runs it while creating the candidate archive.
- Verification, archive inspection, and clean-consumer tests should be explicit workflow steps.
- `prepublishOnly` remains a useful local safety net for publishing a directory, but publishing the already-created tarball does not provide a place to rebuild it. The protected workflow must therefore complete every required check before approval.
- The final publish job should consume the immutable archive produced by the checked build job and verify its checksum before invoking npm.

Bun explicitly notes that publishing a pre-built tarball does not run its publish/pack lifecycle scripts. npm's lifecycle documentation likewise defines packing work around a package being packed, while npm's publish command accepts an already-packed tarball. [`bun publish`](https://bun.com/docs/pm/cli/publish), [npm lifecycle scripts](https://docs.npmjs.com/cli/v11/using-npm/scripts/), [`npm publish`](https://docs.npmjs.com/cli/v11/commands/npm-publish/)

## Recommended issue #20 wording changes

Replace the package inspection and smoke portions of the earlier contract with:

> A repository-owned package inspection command creates an actual tarball with Bun 1.4's `bun pm pack` from exactly the library workspace, validates every archive entry against the release allowlist, and emits its own stable JSON report. Clean consumers install and exercise that same tarball on every supported runtime. The release workflow then runs `npm publish <tarball> --dry-run --json` with the same npm client and archive used by the protected `npm publish <tarball>` job.

The required script names can remain `package:inspect`, `package:smoke`, `publish:dry-run`, and `release:npm`; only their implementation changes. This removes `npm pack` without giving up machine-readable evidence or exact-artifact testing.

No registry write was performed during this research.
