# npm release runbook

This runbook prepares and verifies an exact npm artifact locally. It does not authorize publication by itself.

## Quick commands

Verify release readiness (full acceptance suite, tarball inspection, and npm dry-run):

```bash
bun run release
```

Validate git tag and worktree state before verifying:

```bash
bun run release --tag v<version>
```

Publish after verification succeeds (`npm login` or `NODE_AUTH_TOKEN` must already be configured):

```bash
bun run release --publish
```

## Manual checklist

1. Start from a clean commit on `main`, install with the pinned Bun version and `bun install --frozen-lockfile`.
2. Confirm `packages/nearly-headless-cms/package.json` is the authoritative version, the intended tag is exactly `v<version>`, the changelog contains that version and all breaking migrations, both MIT license files match, and the npm name/version are still available.
3. Run `bun run release` (or `bun run release --tag v<version>` when the tag already exists locally).
4. Preserve the tarball, SHA-256 checksum, and JSON inspection report under `.artifacts/npm/`. All later checks must consume those bytes.
5. Push the reviewed commit and exact `v<version>` tag.
6. Run `bun run release --publish` only after the verification step succeeds.
7. After publication, verify registry metadata, provenance, archive checksum, clean installation, and the GitHub Release notes from the changelog.

Never overwrite, reuse, or retag a defective version. Deprecate it when appropriate and publish a corrected patch or minor version. Unpublish only for an exceptional security or legal reason consistent with npm policy.
