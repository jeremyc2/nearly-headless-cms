# npm release runbook

This runbook prepares and verifies an exact npm artifact. It does not authorize publication by itself.

1. Start from a clean commit on `main`, install with the pinned Bun version and `bun install --frozen-lockfile`, and run `bun run acceptance` with all required automated and manual evidence attached to that commit.
2. Confirm `packages/nearly-headless-cms/package.json` is the authoritative version, the intended tag is exactly `v<version>`, the changelog contains that version and all breaking migrations, both MIT license files match, and the npm name/version are still available.
3. Run `bun run --cwd packages/nearly-headless-cms package:inspect`. Preserve the resulting tarball, SHA-256 checksum, and JSON inspection report. All later checks must consume those bytes.
4. Run `PACKAGE_ARCHIVE=<absolute-tarball> bun run --cwd packages/nearly-headless-cms package:smoke` on Bun 1.4+, Node 22, and Node 24. Run the Filesystem Adapter suite on macOS, Linux, and Windows.
5. Run `PACKAGE_ARCHIVE=<absolute-tarball> bun run --cwd packages/nearly-headless-cms publish:dry-run`. Review npm’s JSON report; do not let npm repack the workspace.
6. Push the reviewed commit and exact `v<version>` tag. The protected `npm` GitHub environment requires a human approval between verification and publication.
7. For the first `0.1.0` release only, use the narrowly scoped bootstrap token in the protected environment with provenance. Immediately configure `.github/workflows/release-npm.yml` as the npm trusted publisher and revoke that token. Later releases use OIDC with no long-lived publication token.
8. After publication, verify registry metadata, provenance, archive checksum, clean installation, and the GitHub Release generated from the changelog.

Never overwrite, reuse, or retag a defective version. Deprecate it when appropriate and publish a corrected patch or minor version. Unpublish only for an exceptional security or legal reason consistent with npm policy.
