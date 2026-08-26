# npm release runbook

This runbook verifies and publishes `nearly-headless-cms` from `packages/nearly-headless-cms`. The package is published on npm; follow these steps for every new version.

## Quick commands

Verify a release candidate (full acceptance suite, tarball inspection, and npm dry-run):

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

## First-time npm setup

1. Log in locally:

   ```bash
   npm login
   npm whoami   # should print jeremyc2
   ```

   Or export a narrowly scoped **Automation** token:

   ```bash
   export NODE_AUTH_TOKEN=npm_xxxxxxxx
   ```

2. Confirm the target version is not already on the registry:

   ```bash
   npm view nearly-headless-cms@<version> version
   ```

   An `E404` means the version slot is free.

## Publishing a new version

Example for `1.0.0`:

### 1. Prepare the release commit

1. Start from a clean checkout of `main` with the pinned Bun version:

   ```bash
   bun install --frozen-lockfile
   ```

2. Confirm `packages/nearly-headless-cms/package.json` has the intended version.
3. Confirm `packages/nearly-headless-cms/CHANGELOG.md` has an entry for that version with any migration notes.
4. Confirm both MIT license files match.
5. Commit and push the version bump to `main`.

### 2. Verify the exact tarball

```bash
bun run release --tag v1.0.0
```

This runs the full acceptance suite, creates `.artifacts/npm/nearly-headless-cms-<version>.tgz`, validates every archive entry, records SHA-256 in `.artifacts/npm/inspection.json`, and runs `npm publish <tarball> --dry-run --json`.

If verification passes:

```text
Release verification passed for nearly-headless-cms@1.0.0.
Publish when ready:
  bun run release --publish
```

### 3. Tag and push

```bash
git tag v1.0.0
git push origin main
git push origin v1.0.0
```

### 4. Publish to npm

```bash
bun run release --publish
```

This publishes the **same tarball** that verification inspected — not a fresh repack. It requires:

- `CONFIRM_NPM_RELEASE=nearly-headless-cms@<version>` (set automatically by the script)
- `PACKAGE_ARCHIVE` pointing at `.artifacts/npm/nearly-headless-cms-<version>.tgz`
- Valid npm credentials

### 5. Post-publish checks

1. Open [npmjs.com/package/nearly-headless-cms](https://www.npmjs.com/package/nearly-headless-cms) and confirm version, metadata, and provenance.
2. Compare the registry tarball checksum with `.artifacts/npm/inspection.json`.
3. Clean install smoke test:

   ```bash
   mkdir /tmp/nhc-test && cd /tmp/nhc-test
   bun init -y
   bun add nearly-headless-cms@<version> effect@4.0.0-rc.111
   ```

4. Create a GitHub Release from the changelog entry for that version.

### 6. After the first publish (bootstrap only)

npm requires the package to exist before [trusted publishing](https://docs.npmjs.com/trusted-publishers/) can be configured. After the first successful publish:

1. Configure the release GitHub Actions workflow as the trusted publisher on npm.
2. Revoke the bootstrap Automation token if one was used.

Later releases can use OIDC from CI without a long-lived token.

## Policy

Never overwrite, reuse, or retag a defective version. Deprecate it on npm when appropriate and publish a corrected patch or minor version. Unpublish only for an exceptional security or legal reason consistent with npm policy.
