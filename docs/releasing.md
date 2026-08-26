# npm release runbook

This runbook verifies and publishes `nearly-headless-cms` from `packages/nearly-headless-cms`. The package is published on npm; follow these steps for every new version.

## Quick commands

Verify a release candidate (full acceptance suite, tarball inspection, and npm dry-run):

```bash
bun run release --tag v<version>
```

Publish the inspected tarball without re-running acceptance (use after verification succeeds):

```bash
bun run release --publish-only
```

Verify and publish in one command (re-runs the full acceptance suite):

```bash
bun run release --tag v<version> --publish
```

## First-time npm setup

1. Confirm the target version is not already on the registry:

   ```bash
   npm view nearly-headless-cms@<version> version
   ```

   An `E404` means the version slot is free.

2. Choose one authentication method for the bootstrap publish:

   **Option A — interactive login (2FA uses a browser device flow)**

   ```bash
   npm login
   npm whoami   # should print jeremyc2
   ```

   When you publish, npm may respond with `EOTP` and print a URL such as `https://www.npmjs.com/auth/cli/...`. Open that URL in a browser, complete sign-in (passkey, security key, or Touch ID), and leave the publish command running in your terminal until npm finishes. There is no `--otp` code to type for this flow.

   **Option B — Automation token (non-interactive bootstrap)**

   Create a narrowly scoped **Automation** token on [npmjs.com](https://www.npmjs.com/), then export it for the publish command:

   ```bash
   export NODE_AUTH_TOKEN=npm_xxxxxxxx
   ```

   Revoke this token after the package exists and trusted publishing is configured.

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

### 2. Update visual baselines when UI changes are intentional

Visual tests compare screenshots against checked-in baselines and require live Example CMS and Public Blog servers. Do **not** run `UPDATE_VISUALS=1 bun run test:visual` on its own — that skips every test because `ACCEPTANCE_SERVERS_READY` is unset.

When a change intentionally alters rendered UI, re-record baselines with:

```bash
bun run update:visuals
```

Review the diff in `acceptance/visual/baselines/`, commit the updated PNGs with the UI change, then continue release verification.

### 3. Verify the exact tarball

```bash
bun run release --tag v1.0.0
```

This runs the full acceptance suite, creates `.artifacts/npm/nearly-headless-cms-<version>.tgz`, validates every archive entry, records SHA-256 in `.artifacts/npm/inspection.json`, and runs `npm publish <tarball> --dry-run --json`.

If verification passes:

```text
Release verification passed for nearly-headless-cms@1.0.0.
Publish when ready:
  bun run release --publish-only
```

### 4. Tag and push

```bash
git tag v1.0.0
git push origin main
git push origin v1.0.0
```

### 5. Publish to npm

```bash
bun run release --publish-only
```

This uploads the **same tarball** that verification inspected — not a fresh repack. The script:

- requires `.artifacts/npm/nearly-headless-cms-<version>.tgz` and `.artifacts/npm/inspection.json` from step 3;
- passes `--provenance=false` on your machine because npm can only generate Sigstore attestations from a CI OIDC provider such as GitHub Actions (the manifest still sets `publishConfig.provenance: true` for later CI publishes);
- prints browser-auth guidance when `NODE_AUTH_TOKEN` is unset;
- passes `--provenance` automatically when `GITHUB_ACTIONS=true`.

If browser auth fails or the terminal closes before EOTP completes, rerun `bun run release --publish-only` and open the new URL npm prints.

You do not need a separate manual `npm publish` command unless you are debugging registry auth outside the release script.

### 6. Post-publish checks

1. Open [npmjs.com/package/nearly-headless-cms](https://www.npmjs.com/package/nearly-headless-cms) and confirm version and metadata. The first bootstrap publish will not show provenance; later CI publishes will.
2. Compare the registry tarball checksum with `.artifacts/npm/inspection.json`.
3. Clean install smoke test:

   ```bash
   mkdir /tmp/nhc-test && cd /tmp/nhc-test
   bun init -y
   bun add nearly-headless-cms@<version> effect@4.0.0-rc.111
   ```

4. Create a GitHub Release from the changelog entry for that version.

### 7. After the first publish (bootstrap only)

npm requires the package to exist before [trusted publishing](https://docs.npmjs.com/trusted-publishers/) can be configured. After the first successful publish:

1. Configure the release GitHub Actions workflow as the trusted publisher on npm.
2. Revoke the bootstrap Automation token if one was used.

Later releases can use OIDC from CI without a long-lived token and will receive provenance automatically.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Automatic provenance generation not supported for provider: null` | Publishing locally with provenance enabled | Use `bun run release --publish-only`; the script passes `--provenance=false` locally |
| `EOTP` / browser URL printed | npm account uses 2FA | Open the printed URL, sign in, leave the command running; or set `NODE_AUTH_TOKEN` |
| `Missing inspected archive` on `--publish-only` | Verification not run yet | Run `bun run release --tag v<version>` first |
| Publish succeeded but you need to retry auth | Terminal closed during EOTP | Rerun `bun run release --publish-only` |

## Policy

Never overwrite, reuse, or retag a defective version. Deprecate it on npm when appropriate and publish a corrected patch or minor version. Unpublish only for an exceptional security or legal reason consistent with npm policy.
