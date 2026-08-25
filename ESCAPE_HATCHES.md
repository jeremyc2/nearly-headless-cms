# Escape Hatches

This document tracks every lint and type-check escape hatch in the repository.

We prefer strict linting and type-checking. Each escape hatch below is intentional,
documented, and assigned a stable code for review and remediation.

## Conventions

When you must disable a rule:

1. Prefer fixing the underlying issue over adding an escape hatch.
2. Use `// oxlint-disable-next-line` for a single line; avoid file-wide `// oxlint-disable`.
3. Every escape hatch must include both a **code** and a **justification** in this format:

   ```ts
   // oxlint-disable-next-line <rule> -- [EH-042] <justification>
   ```

   ```ts
   // @ts-expect-error [EH-042] <justification>
   ```

4. Regenerate this file with `bun run scripts/escape-hatches.ts sync` when adding or changing an escape hatch.
5. Run `bun run check:escape-hatches` to verify every escape hatch has a code and this file exists.

## Justification Registry

### `@ts-expect-error`

#### EH-001: Arbitrary private subpaths are not public package exports.

**Locations:**

- `packages/nearly-headless-cms/test/types/public-api.ts:28`

### `effecttsgo/async-function`

#### EH-002: Asset staging finalization coordinates Bun writer flush and fsync boundaries.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-support.ts:162`

#### EH-003: Atomic persistence coordinates Bun and node filesystem promises.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-support.ts:261`

#### EH-004: baseline bytes are read through Promise-based Bun filesystem APIs.

**Locations:**

- `acceptance/visual/responsive-baselines.test.ts:32`

#### EH-005: Bun filesystem handles expose Promise-based synchronization boundaries.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-support.ts:177`

#### EH-006: Bun lifecycle hook performs async cleanup.

**Locations:**

- `apps/example-cms/test/integration/destructive-workflows.test.ts:27`
- `apps/example-cms/test/integration/headless-api.test.ts:30`
- `apps/example-cms/test/integration/public-visibility.test.ts:29`
- `apps/example-cms/test/integration/publication-validation.test.ts:29`

#### EH-007: Bun lifecycle hook performs async system setup.

**Locations:**

- `apps/example-cms/test/integration/destructive-workflows.test.ts:22`
- `apps/example-cms/test/integration/headless-api.test.ts:25`
- `apps/example-cms/test/integration/public-visibility.test.ts:24`
- `apps/example-cms/test/integration/publication-validation.test.ts:22`

#### EH-008: Bun WebView evaluation and sleep are Promise-based platform lifecycle operations.

**Locations:**

- `acceptance/visual/responsive-baselines.test.ts:70`
- `acceptance/webview/journey.test.ts:169`
- `acceptance/webview/qualification.test.ts:44`

#### EH-009: Bun's test runner requires a Promise-returning lifecycle callback.

**Locations:**

- `acceptance/visual/responsive-baselines.test.ts:96`
- `acceptance/webview/journey.test.ts:191`
- `acceptance/webview/qualification.test.ts:66`

#### EH-010: cache invalidation must remain sequential.

**Locations:**

- `apps/example-cms/src/ui/content-list-mutations.ts:32`

#### EH-011: Cleanup intentionally preserves sequential filesystem ordering.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-root.ts:100`

#### EH-012: CLI bootstrap reads package.json before any Effect program exists.

**Locations:**

- `packages/nearly-headless-cms/scripts/package-manifest.ts:5`
- `scripts/package-manifest.ts:5`

#### EH-013: CLI command runner awaits process completion.

**Locations:**

- `scripts/run-acceptance.ts:22`

#### EH-014: CLI readiness polling requires awaited retries.

**Locations:**

- `scripts/run-acceptance.ts:39`

#### EH-015: definition routes delegate to catalog and migration handlers sequentially.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-definition-routes.ts:5`

#### EH-016: deletion sequence requires awaited server state.

**Locations:**

- `apps/example-cms/src/ui/entry-editor-mutations.ts:23`

#### EH-017: Diagnostic inspection is a read-only filesystem boundary.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-root.ts:81`

#### EH-018: durable blob commits use Promise-based filesystem synchronization.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-support.ts:121`

#### EH-019: entry creation sequences dependent requests.

**Locations:**

- `apps/example-cms/src/ui/content-list-mutations.ts:19`

#### EH-020: escape hatch registry CLI uses async filesystem IO.

**Locations:**

- `scripts/escape-hatches.ts:2`

#### EH-021: FileHandle.write is Promise-based and must remain ordered.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-request-parsing-support.ts:267`

#### EH-022: fingerprint validation awaits interruptible Effect execution.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-handler-support.ts:119`

#### EH-023: fixture setup intentionally awaits native filesystem and CMS startup.

**Locations:**

- `apps/example-cms/test/integration/destructive-workflows-fixture-scenarios.ts:11`
- `apps/example-cms/test/integration/headless-api-fixture-scenarios.ts:11`
- `apps/example-cms/test/integration/public-visibility-scenarios.ts:94`
- `apps/example-cms/test/integration/publication-validation-scenarios.ts:104`

#### EH-024: fixture teardown awaits native filesystem cleanup.

**Locations:**

- `apps/example-cms/test/integration/destructive-workflows-fixture-scenarios.ts:18`
- `apps/example-cms/test/integration/headless-api-fixture-scenarios.ts:17`
- `apps/example-cms/test/integration/public-visibility-scenarios.ts:102`
- `apps/example-cms/test/integration/publication-validation-scenarios.ts:111`

#### EH-025: generated clients expose a Promise-backed transport boundary; converting this callback to Effect would change the generated public client contract.

**Locations:**

- `apps/example-cms/src/generated/headless-openapi-client-runtime-transport.ts:150`
- `apps/example-cms/src/generated/headless-openapi-client-runtime-transport.ts:198`
- `apps/example-cms/src/generated/headless-openapi-client-runtime-transport.ts:236`
- `apps/example-cms/src/generated/management-openapi-client-runtime-transport.ts:180`
- `apps/example-cms/src/generated/management-openapi-client-runtime-transport.ts:228`
- `apps/example-cms/src/generated/management-openapi-client-runtime-transport.ts:266`
- `apps/public-blog/src/generated/headless-openapi-client-runtime-transport.ts:150`
- `apps/public-blog/src/generated/headless-openapi-client-runtime-transport.ts:198`
- `apps/public-blog/src/generated/headless-openapi-client-runtime-transport.ts:236`
- `scripts/openapi-client-generator/runtime-template.ts:2`
- `scripts/openapi-client-generator/runtime-template.ts:46`
- `scripts/openapi-client-generator/runtime-template.ts:81`

#### EH-026: generated clients expose a Promise-backed transport boundary.

**Locations:**

- `apps/example-cms/src/generated/headless-openapi-client-runtime-transport.ts:17`
- `apps/example-cms/src/generated/management-openapi-client-runtime-transport.ts:17`
- `apps/public-blog/src/generated/headless-openapi-client-runtime-transport.ts:17`
- `scripts/openapi-client-generator/source-file-builders.ts:70`

#### EH-027: Guard creation requires sequential Bun filesystem operations.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-io.ts:76`

#### EH-028: Handler is a Web-standard Promise<Response> callback.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-request-timeout-support.ts:98`

#### EH-029: helper intentionally awaits a native HTTP promise.

**Locations:**

- `packages/nearly-headless-cms/test/contract/http-contract-deletion-scenarios.ts:25`
- `packages/nearly-headless-cms/test/contract/http-contract-deletion-scenarios.ts:46`
- `packages/nearly-headless-cms/test/contract/http-contract-deletion-scenarios.ts:63`

#### EH-030: helper intentionally awaits native filesystem cleanup.

**Locations:**

- `apps/example-cms/test/integration/headless-api-restart-scenarios.ts:33`

#### EH-031: helper intentionally awaits native HTTP promises.

**Locations:**

- `apps/example-cms/test/integration/headless-api-delivery-scenarios.ts:27`
- `apps/example-cms/test/integration/headless-api-delivery-scenarios.ts:44`
- `apps/example-cms/test/integration/headless-api-management-scenarios.ts:34`
- `apps/example-cms/test/integration/headless-api-management-scenarios.ts:69`
- `apps/example-cms/test/integration/headless-api-management-scenarios.ts:82`
- `apps/example-cms/test/integration/headless-api-management-scenarios.ts:101`
- `apps/example-cms/test/integration/headless-api-management-scenarios.ts:131`
- `apps/example-cms/test/integration/headless-api-restart-scenarios.ts:21`

#### EH-032: HTTP contract assertions intentionally await native promises.

**Locations:**

- `apps/example-cms/test/integration/headless-api-delivery-scenarios.ts:72`
- `apps/example-cms/test/integration/headless-api-delivery-scenarios.ts:89`
- `apps/example-cms/test/integration/headless-api-delivery-scenarios.ts:97`
- `apps/example-cms/test/integration/headless-api-delivery-scenarios.ts:105`
- `apps/example-cms/test/integration/headless-api-delivery-scenarios.ts:117`
- `apps/example-cms/test/integration/headless-api-delivery-scenarios.ts:125`
- `apps/example-cms/test/integration/headless-api-delivery-scenarios.ts:133`
- `apps/example-cms/test/integration/headless-api-management-scenarios.ts:147`
- `apps/example-cms/test/integration/headless-api-management-scenarios.ts:167`
- `apps/example-cms/test/integration/headless-api-management-scenarios.ts:175`
- `apps/example-cms/test/integration/headless-api-management-scenarios.ts:197`
- `apps/example-cms/test/integration/headless-api-management-scenarios.ts:220`
- `apps/example-cms/test/integration/headless-api-management-scenarios.ts:230`
- `apps/example-cms/test/integration/headless-api-management-scenarios.ts:254`
- `apps/example-cms/test/integration/headless-api-restart-scenarios.ts:42`
- `apps/example-cms/test/integration/public-visibility-scenarios.ts:193`
- `apps/example-cms/test/integration/public-visibility-scenarios.ts:200`
- `apps/example-cms/test/integration/public-visibility-scenarios.ts:215`
- `apps/example-cms/test/integration/public-visibility-scenarios.ts:233`
- `apps/example-cms/test/integration/publication-validation-scenarios.ts:230`
- `apps/example-cms/test/integration/publication-validation-scenarios.ts:246`
- `apps/example-cms/test/integration/publication-validation-scenarios.ts:267`
- `packages/nearly-headless-cms/test/contract/http-contract-deletion-scenarios.ts:75`
- `packages/nearly-headless-cms/test/contract/http-contract-deletion-scenarios.ts:83`
- `packages/nearly-headless-cms/test/contract/http-contract-deletion-scenarios.ts:103`
- `packages/nearly-headless-cms/test/contract/http-contract-management-scenarios.ts:26`
- `packages/nearly-headless-cms/test/contract/http-contract-management-scenarios.ts:59`
- `packages/nearly-headless-cms/test/contract/http-contract-management-scenarios.ts:69`
- `packages/nearly-headless-cms/test/contract/http-contract-multipart-scenarios.ts:75`
- `packages/nearly-headless-cms/test/contract/http-contract-multipart-scenarios.ts:83`
- `packages/nearly-headless-cms/test/contract/http-contract-multipart-scenarios.ts:100`
- `packages/nearly-headless-cms/test/contract/http-contract-multipart-scenarios.ts:110`
- `packages/nearly-headless-cms/test/contract/http-contract-transport-scenarios.ts:72`
- `packages/nearly-headless-cms/test/contract/http-contract-transport-scenarios.ts:84`
- `packages/nearly-headless-cms/test/contract/http-contract-transport-scenarios.ts:94`
- `packages/nearly-headless-cms/test/contract/http-contract-transport-scenarios.ts:102`
- `packages/nearly-headless-cms/test/contract/http-contract-transport-scenarios.ts:113`
- `packages/nearly-headless-cms/test/contract/http-contract-transport-scenarios.ts:129`
- `packages/nearly-headless-cms/test/contract/http-contract-transport-scenarios.ts:139`
- `packages/nearly-headless-cms/test/contract/http-contract-transport-scenarios.ts:151`

#### EH-033: interruptible outcomes are awaited before routing continues.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-handler-support.ts:136`

#### EH-034: journey assertions compose awaited WebView navigation and evaluation.

**Locations:**

- `acceptance/webview/journey.test.ts:21`
- `acceptance/webview/journey.test.ts:35`
- `acceptance/webview/journey.test.ts:57`
- `acceptance/webview/journey.test.ts:78`
- `acceptance/webview/journey.test.ts:106`

#### EH-035: journey orchestration composes native WebView Promise operations.

**Locations:**

- `acceptance/webview/journey.test.ts:136`
- `acceptance/webview/journey.test.ts:149`

#### EH-036: JSON loading uses Bun's asynchronous file API.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-root-load-support.ts:58`

#### EH-037: Lock cleanup reads and removes a Bun filesystem record.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-io.ts:218`

#### EH-038: Lock creation requires sequential Bun filesystem operations.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-io.ts:88`

#### EH-039: Lock records are read through Bun's filesystem Promise API.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-io.ts:173`

#### EH-040: multipart parsing is Promise-based and this helper is not a pipeable Effect API.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-request-parsing-support.ts:213`

#### EH-041: parallel architecture scans use async file reads.

**Locations:**

- `scripts/check-architecture.ts:193`

#### EH-042: parallel portability scans use async file reads.

**Locations:**

- `scripts/check-architecture.ts:207`

#### EH-043: Persistence spans ordered atomic filesystem writes.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-io.ts:136`

#### EH-044: qualification assertions compose awaited WebView navigation and evaluation.

**Locations:**

- `acceptance/webview/qualification.test.ts:10`

#### EH-045: React query callback awaits cache invalidation.

**Locations:**

- `apps/example-cms/src/ui/assets-page-mutations-support.ts:27`
- `apps/example-cms/src/ui/assets-page-mutations-support.ts:37`
- `apps/example-cms/src/ui/entry-editor-history-panel-body.tsx:178`

#### EH-046: React query callback awaits navigation.

**Locations:**

- `apps/example-cms/src/ui/entry-editor-mutations.ts:109`

#### EH-047: React query callback sequences invalidation before navigation.

**Locations:**

- `apps/example-cms/src/ui/content-list-mutations.ts:31`

#### EH-048: React query error callback awaits the latest server state.

**Locations:**

- `apps/example-cms/src/ui/entry-editor-mutations.ts:148`

#### EH-049: React query mutation is an intentional browser async boundary.

**Locations:**

- `apps/example-cms/src/ui/overview-rebuild-support.ts:5`

#### EH-050: React query mutation must bridge browser fetch.

**Locations:**

- `apps/example-cms/src/ui/content-list-mutations.ts:18`

#### EH-051: Recovery locking is a filesystem callback boundary.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-io.ts:24`

#### EH-052: recursive acceptance retries compose native WebView Promise operations.

**Locations:**

- `acceptance/webview/qualification.test.ts:68`

#### EH-053: recursive polling requires awaited retries.

**Locations:**

- `scripts/run-acceptance.ts:44`

#### EH-054: request handling awaits body parsing and Effect execution.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-handler.ts:138`

#### EH-055: request handling awaits route dispatch before returning a final response.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-handler.ts:103`

#### EH-056: Returned release callback closes the Bun filesystem guard.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-io.ts:38`

#### EH-057: Root initialization coordinates ordered filesystem operations.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-root-load-generation-support.ts:59`
- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-root-load-generation-support.ts:73`
- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-root-load-generation-support.ts:81`
- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-root-load-support.ts:29`
- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-root.ts:44`
- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-root.ts:65`

#### EH-058: route dispatch is a plain async helper, not a pipeable Effect API.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-route-dispatch.ts:7`

#### EH-059: route handlers await JSON body parsing before Effect execution.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-asset-routes.ts:74`
- `packages/nearly-headless-cms/src/http/http-transport-definition-catalog-routes.ts:21`
- `packages/nearly-headless-cms/src/http/http-transport-definition-catalog-routes.ts:56`
- `packages/nearly-headless-cms/src/http/http-transport-definition-migration-routes.ts:19`
- `packages/nearly-headless-cms/src/http/http-transport-definition-migration-routes.ts:66`
- `packages/nearly-headless-cms/src/http/http-transport-definition-migration-routes.ts:121`
- `packages/nearly-headless-cms/src/http/http-transport-entry-routes.ts:46`
- `packages/nearly-headless-cms/src/http/http-transport-entry-routes.ts:72`
- `packages/nearly-headless-cms/src/http/http-transport-entry-routes.ts:102`
- `packages/nearly-headless-cms/src/http/http-transport-entry-routes.ts:155`
- `packages/nearly-headless-cms/src/http/http-transport-entry-routes.ts:194`
- `packages/nearly-headless-cms/src/http/http-transport-entry-routes.ts:243`

#### EH-060: scenario intentionally awaits native HTTP promises.

**Locations:**

- `apps/example-cms/test/integration/destructive-workflows-asset-scenarios.ts:86`
- `apps/example-cms/test/integration/destructive-workflows-author-scenarios.ts:61`

#### EH-061: screenshot and filesystem APIs are Promise-based Bun platform operations.

**Locations:**

- `acceptance/visual/responsive-baselines.test.ts:11`

#### EH-062: snapshot resolution awaits interruptible Effect execution before routing.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-handler-support.ts:158`

#### EH-063: Stale guard recovery reads and reclaims a Bun filesystem record.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-io.ts:181`

#### EH-064: Stale lock recovery coordinates sequential Bun filesystem operations.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-io.ts:59`
- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-io.ts:195`

#### EH-065: the public Web handler contract returns a Promise<Response>.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-response.ts:204`

#### EH-066: Web Request.arrayBuffer is Promise-based and this helper is not a pipeable Effect API.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-request-parsing.ts:99`

#### EH-067: Writer lock creation is a sequential Bun filesystem boundary.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-io.ts:46`
- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-io.ts:225`

### `effecttsgo/crypto-random-uuid`

#### EH-068: browser UI labels need a synchronous local identifier.

**Locations:**

- `apps/example-cms/src/ui/content-list-support.ts:12`

#### EH-069: default request IDs are generated synchronously before Effect execution.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-handler-support.ts:203`

#### EH-070: lock acquisition is a synchronous token-generation step around Bun file operations.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-io.ts:27`
- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-io.ts:51`

#### EH-071: staging paths are built synchronously in Bun's filesystem bridge.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-support.ts:269`

#### EH-072: staging paths are computed before the Effect stream starts and must remain synchronous.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-support.ts:80`

#### EH-073: the management client accepts a synchronous idempotency key.

**Locations:**

- `apps/example-cms/src/ui/assets-page-mutations-support.ts:10`
- `apps/example-cms/src/ui/assets-page-mutations-support.ts:24`

### `effecttsgo/extends-native-error`

#### EH-074: This transport-only error is converted to a CmsError before entering an Effect failure channel.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-request-failure.ts:1`

### `effecttsgo/global-console`

#### EH-075: acceptance completion is intentionally emitted to CLI stdout.

**Locations:**

- `scripts/run-acceptance.ts:109`

#### EH-076: acceptance progress is intentionally emitted to CLI stdout.

**Locations:**

- `scripts/run-acceptance.ts:27`
- `scripts/run-acceptance.ts:90`

#### EH-077: escape hatch registry CLI reports to stdout and stderr.

**Locations:**

- `scripts/escape-hatches.ts:3`

#### EH-078: this script's contract is machine-readable CLI stdout.

**Locations:**

- `scripts/check-architecture.ts:237`

### `effecttsgo/global-fetch`

#### EH-079: Browser mutation boundary is owned by the UI query client.

**Locations:**

- `apps/example-cms/src/ui/overview-rebuild-support.ts:7`

#### EH-080: CLI acceptance polling intentionally uses the platform fetch boundary.

**Locations:**

- `scripts/run-acceptance.ts:50`

#### EH-081: generated clients intentionally use the platform fetch boundary so callers can supply the browser or server runtime.

**Locations:**

- `apps/example-cms/src/generated/headless-openapi-client-runtime-transport.ts:104`
- `apps/example-cms/src/generated/management-openapi-client-runtime-transport.ts:104`
- `apps/public-blog/src/generated/headless-openapi-client-runtime-transport.ts:104`
- `scripts/openapi-client-generator/runtime-template.ts:184`

### `effecttsgo/global-fetch-in-effect`

#### EH-082: generated clients intentionally use the platform fetch boundary so callers can supply the browser or server runtime.

**Locations:**

- `apps/example-cms/src/generated/headless-openapi-client-runtime-transport.ts:104`
- `apps/example-cms/src/generated/management-openapi-client-runtime-transport.ts:104`
- `apps/public-blog/src/generated/headless-openapi-client-runtime-transport.ts:104`
- `scripts/openapi-client-generator/runtime-template.ts:184`

### `effecttsgo/missing-pipeable-signature`

#### EH-083: compileSnapshot is exported for typed internal call sites.

**Locations:**

- `packages/nearly-headless-cms/src/content-definition-compile.ts:94`

#### EH-084: content list helper is intentionally a direct three-argument operation.

**Locations:**

- `apps/example-cms/src/ui/content-list-support.ts:14`
- `apps/example-cms/src/ui/content-list-support.ts:73`

#### EH-085: content list helper is intentionally a direct two-argument operation.

**Locations:**

- `apps/example-cms/src/ui/content-list-support.ts:119`

#### EH-086: dual's generic overload is not inferred by the linter for this public helper.

**Locations:**

- `packages/nearly-headless-cms/src/content-definition-compatibility.ts:10`
- `packages/nearly-headless-cms/src/content-definition-compile.ts:124`
- `packages/nearly-headless-cms/src/definition-migration.ts:25`
- `packages/nearly-headless-cms/src/definition-migration.ts:61`
- `packages/nearly-headless-cms/src/rich-text.ts:63`
- `packages/nearly-headless-cms/src/rich-text.ts:71`
- `packages/nearly-headless-cms/src/rich-text.ts:77`

#### EH-087: editor transaction API is intentionally a direct two-argument operation.

**Locations:**

- `apps/example-cms/src/ui/rich-text-editor/transactions-dispatch.ts:63`

#### EH-088: JSON field helper is intentionally a direct two-argument operation.

**Locations:**

- `apps/example-cms/test/integration/headless-api-support.ts:36`

#### EH-089: local schema adapter is intentionally direct-call only.

**Locations:**

- `apps/example-cms/src/delivery-support.ts:154`

#### EH-090: multipart parsing is Promise-based and this helper is not a pipeable Effect API.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-request-parsing-support.ts:213`
- `packages/nearly-headless-cms/src/http/http-transport-request-parsing.ts:170`

#### EH-091: public serialize helper is not a pipeable Effect API.

**Locations:**

- `packages/nearly-headless-cms/src/rich-text.ts:69`

#### EH-092: Rich Text helpers are not pipeable Effect APIs.

**Locations:**

- `packages/nearly-headless-cms/src/rich-text.ts:1`

#### EH-093: route dispatch is a plain async helper, not a pipeable Effect API.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-route-dispatch.ts:7`

#### EH-094: test helper is not a pipeable Effect API.

**Locations:**

- `packages/nearly-headless-cms/test/contract/authorization-expansion-support.ts:56`

#### EH-095: test JSON field helper is intentionally a direct two-argument operation.

**Locations:**

- `apps/example-cms/test/integration/public-visibility-support.ts:27`
- `apps/example-cms/test/integration/public-visibility-support.ts:38`

#### EH-096: test URL helper is intentionally a direct two-argument operation.

**Locations:**

- `apps/example-cms/test/integration/headless-api-support.ts:23`
- `apps/example-cms/test/integration/publication-validation-support.ts:27`
- `apps/example-cms/test/integration/publication-validation-support.ts:30`

#### EH-097: UI label helper is intentionally a direct two-argument operation.

**Locations:**

- `apps/example-cms/src/ui/main-labels.ts:15`
- `apps/example-cms/src/ui/main-labels.ts:88`
- `apps/example-cms/src/ui/main-labels.ts:185`

#### EH-098: UI value helper is intentionally a direct two-argument operation.

**Locations:**

- `apps/example-cms/src/ui/main-entry-support.ts:89`

#### EH-099: Web handler timeout wrapper is not a pipeable Effect API.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-request-timeout-support.ts:87`

#### EH-100: Web Request.arrayBuffer is Promise-based and this helper is not a pipeable Effect API.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-request-parsing.ts:99`

### `effecttsgo/node-builtin-import`

#### EH-210: Baseline paths are test-runner setup paths; there is no Effect runtime involved in this Bun test.

**Locations:**

- `acceptance/visual/responsive-baselines.test.ts:3`

#### EH-101: Bun does not provide a path manipulation API; these operations are platform-neutral string handling.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-io.ts:19`
- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-root-imports.ts:14`
- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-root-load-imports.ts:4`
- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-services-imports.ts:23`
- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-support-imports.ts:16`

#### EH-211: Path joining is host-path setup for this filesystem integration test, outside the Effect service graph.

**Locations:**

- `packages/nearly-headless-cms/test/filesystem/filesystem-persistence-scenarios.ts:35`
- `packages/nearly-headless-cms/test/filesystem/filesystem-persistence-writer-scenarios.ts:10`

#### EH-102: Standalone CLI resolves repository paths before any Effect application exists.

**Locations:**

- `scripts/check-architecture.ts:2`
- `scripts/escape-hatches.ts:18`
- `scripts/release.ts:1`
- `scripts/run-acceptance.ts:2`

#### EH-103: Temporary upload staging requires node fs primitives unavailable in the HTTP FileSystem abstraction.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-request-parsing-support.ts:15`

#### EH-104: Temporary upload staging requires node os primitives unavailable in the HTTP FileSystem abstraction.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-request-parsing-support.ts:21`

#### EH-105: Temporary upload staging requires node path primitives unavailable in the HTTP FileSystem abstraction.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-request-parsing-support.ts:19`

#### EH-212: The test exercises the Bun filesystem adapter's on-disk behavior; these helpers have no Bun equivalent.

**Locations:**

- `packages/nearly-headless-cms/test/filesystem/filesystem-persistence-scenarios.ts:32`
- `packages/nearly-headless-cms/test/filesystem/filesystem-persistence-writer-scenarios.ts:12`

#### EH-106: This Bun adapter needs durable fsync/open and directory primitives unavailable in Effect's portable FileSystem layer.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-io.ts:14`
- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-root-imports.ts:12`
- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-root-load-imports.ts:6`
- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-support-imports.ts:14`

### `effecttsgo/prefer-schema-over-json`

#### EH-107: request bodies are OpenAPI-generated unknown shapes and must be serialized using the browser JSON boundary.

**Locations:**

- `apps/example-cms/src/generated/headless-openapi-client-runtime-transport.ts:63`
- `apps/example-cms/src/generated/management-openapi-client-runtime-transport-request-support.ts:36`
- `apps/example-cms/src/generated/management-openapi-client-runtime-transport.ts:63`
- `apps/public-blog/src/generated/headless-openapi-client-runtime-transport.ts:63`
- `scripts/openapi-client-generator/runtime-template.ts:147`

### `effecttsgo/run-effect-inside-effect`

#### EH-108: bridge the abort callback into Promise.race.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-request-timeout-support.ts:84`

#### EH-109: interrupt the owned timer fiber during Web handler cleanup.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-request-timeout-support.ts:111`

#### EH-110: this Web handler owns a timer fiber outside the request Effect.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-request-timeout-support.ts:105`

### `effecttsgo/strict-effect-provide`

#### EH-111: test entry point needs a fresh isolated layer per run.

**Locations:**

- `packages/nearly-headless-cms/test/contract/authorization-expansion-support.ts:66`
- `packages/nearly-headless-cms/test/integration/cms-service.test.ts:44`
- `packages/nearly-headless-cms/test/integration/definition-lifecycle.test.ts:19`
- `packages/nearly-headless-cms/test/integration/definition-lifecycle.test.ts:25`
- `packages/nearly-headless-cms/test/integration/definition-lifecycle.test.ts:31`
- `packages/nearly-headless-cms/test/integration/entry-history.test.ts:17`

#### EH-112: test entry point needs a fresh isolated layer.

**Locations:**

- `packages/nearly-headless-cms/test/contract/http-contract-deletion-scenarios.ts:19`
- `packages/nearly-headless-cms/test/contract/http-contract-management-scenarios.ts:20`
- `packages/nearly-headless-cms/test/contract/http-contract-multipart-scenarios.ts:44`
- `packages/nearly-headless-cms/test/contract/http-contract-transport-scenarios.ts:46`
- `packages/nearly-headless-cms/test/contract/http-contract-transport-scenarios.ts:66`
- `packages/nearly-headless-cms/test/filesystem/filesystem-persistence-scenarios.ts:196`
- `packages/nearly-headless-cms/test/filesystem/filesystem-persistence-writer-scenarios.ts:24`
- `packages/nearly-headless-cms/test/filesystem/filesystem-persistence-writer-scenarios.ts:34`

### `eslint/func-style`

#### EH-113: error status helpers are function declarations to keep CmsError Schema narrowing readable.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-response.ts:41`

### `eslint/max-lines`

#### EH-114: escape hatch registry coordinates scan, sync, and render.

**Locations:**

- `scripts/escape-hatches.ts:4`

#### EH-115: generated transport runtime exceeds local module line budget.

**Locations:**

- `apps/example-cms/src/generated/headless-openapi-client-runtime-transport.ts:20`
- `apps/example-cms/src/generated/management-openapi-client-runtime-transport.ts:20`
- `apps/public-blog/src/generated/headless-openapi-client-runtime-transport.ts:20`
- `scripts/openapi-client-generator/source-file-builders.ts:73`

#### EH-116: reference and projection helpers are intentionally colocated.

**Locations:**

- `packages/nearly-headless-cms/src/cms-entry-references-support.ts:25`

#### EH-117: validation helpers are intentionally colocated.

**Locations:**

- `packages/nearly-headless-cms/src/content-definition-entry-validation.ts:12`

### `eslint/max-lines-per-function`

#### EH-118: escape hatch parsing and rendering are intentionally colocated.

**Locations:**

- `scripts/escape-hatches.ts:8`

### `eslint/max-params`

#### EH-213: escape hatch parsing bundles file, line, and context inputs.

**Locations:**

- `scripts/escape-hatches.ts:15`

### `eslint/max-statements`

#### EH-119: escape hatch registry coordinates sequential file updates.

**Locations:**

- `scripts/escape-hatches.ts:5`

### `eslint/no-await-in-loop`

#### EH-120: file scans and updates must preserve source order.

**Locations:**

- `scripts/escape-hatches.ts:6`

### `eslint/no-continue`

#### EH-121: registry assignment skips unresolved rule and code pairs.

**Locations:**

- `scripts/escape-hatches.ts:9`

### `eslint/no-magic-numbers`

#### EH-122: registry codes use fixed-width numeric padding.

**Locations:**

- `scripts/escape-hatches.ts:7`

### `eslint/no-ternary`

#### EH-123: generated fetch bridge keeps compact signal fallback.

**Locations:**

- `apps/example-cms/src/generated/headless-openapi-client-runtime-transport.ts:21`
- `apps/example-cms/src/generated/management-openapi-client-runtime-transport.ts:21`
- `apps/public-blog/src/generated/headless-openapi-client-runtime-transport.ts:21`
- `scripts/openapi-client-generator/source-file-builders.ts:74`

#### EH-124: registry formatting keeps compact comment labels.

**Locations:**

- `scripts/escape-hatches.ts:10`

### `eslint/one-var`

#### EH-125: helpers with readonly disables must stay as separate const declarations.

**Locations:**

- `packages/nearly-headless-cms/src/cms-entry-expansion-field-group-support.ts:10`
- `packages/nearly-headless-cms/src/cms-entry-expansion-relationship-support.ts:14`
- `packages/nearly-headless-cms/src/cms-entry-references-support.ts:23`
- `packages/nearly-headless-cms/src/content-definition-entry-validation.ts:10`
- `packages/nearly-headless-cms/src/entry-query-projection.ts:3`
- `packages/nearly-headless-cms/src/http/http-transport-handler-support.ts:14`
- `packages/nearly-headless-cms/src/http/http-transport-request-parsing-support.ts:10`

#### EH-126: registry helpers keep related declarations grouped.

**Locations:**

- `scripts/escape-hatches.ts:11`

### `eslint/require-unicode-regexp`

#### EH-127: registry parsing uses ASCII comment markers only.

**Locations:**

- `scripts/escape-hatches.ts:12`

### `eslint/sort-imports`

#### EH-128: export route imports follow dependency grouping.

**Locations:**

- `apps/example-cms/src/delivery-export-route-support.ts:1`

#### EH-129: history panel imports follow UI dependency grouping.

**Locations:**

- `apps/example-cms/src/ui/entry-editor-history-panel-body.tsx:1`

### `eslint/sort-vars`

#### EH-130: generated runtime helpers are ordered for readability.

**Locations:**

- `apps/example-cms/src/generated/headless-openapi-client-runtime-transport.ts:19`
- `apps/example-cms/src/generated/management-openapi-client-runtime-transport.ts:19`
- `apps/public-blog/src/generated/headless-openapi-client-runtime-transport.ts:19`
- `scripts/openapi-client-generator/source-file-builders.ts:72`

#### EH-131: helper declaration order follows dependency order.

**Locations:**

- `packages/nearly-headless-cms/src/cms-entry-expansion-field-group-support.ts:11`
- `packages/nearly-headless-cms/src/cms-entry-expansion-relationship-support.ts:15`
- `packages/nearly-headless-cms/src/cms-entry-references-support.ts:24`
- `packages/nearly-headless-cms/src/content-definition-entry-validation.ts:11`

#### EH-132: registry helpers follow parse, assign, and render order.

**Locations:**

- `scripts/escape-hatches.ts:13`

#### EH-133: test constants follow scenario narrative order.

**Locations:**

- `packages/nearly-headless-cms/test/contract/authorization-expansion.test.ts:2`

### `no-await-in-loop`

#### EH-134: checks intentionally run sequentially.

**Locations:**

- `scripts/check-architecture.ts:218`

#### EH-135: cleanup must remain sequential.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-root.ts:106`

#### EH-136: handlers must run sequentially until one matches.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-route-dispatch.ts:13`

#### EH-137: preserve ordered chunk writes.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-request-parsing-support.ts:271`

#### EH-138: recursive cleanup must remain sequential.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-root.ts:110`

### `typescript/no-unnecessary-type-parameters`

#### EH-139: React panel helpers preserve local prop aliases for component call sites.

**Locations:**

- `apps/example-cms/src/ui/assets-page-dialogs-support.tsx:2`
- `apps/example-cms/src/ui/assets-page-header-support.tsx:2`
- `apps/example-cms/src/ui/assets-page-panels-support.tsx:8`
- `apps/example-cms/src/ui/entry-editor-controller-local-state-support.ts:15`
- `apps/example-cms/src/ui/entry-editor-history-panel-body.tsx:9`
- `apps/example-cms/src/ui/entry-editor-publication-panel-fields-support.tsx:14`
- `apps/example-cms/src/ui/entry-editor-publication-panel-sections-support.tsx:6`
- `apps/example-cms/src/ui/entry-editor-publication-panel-support.tsx:7`
- `apps/example-cms/src/ui/entry-editor-rich-text-field-support.ts:18`
- `apps/example-cms/src/ui/entry-editor-rich-text-insert-dialog-support.tsx:8`
- `apps/example-cms/src/ui/entry-editor-rich-text-insert-dialog.tsx:9`
- `apps/example-cms/src/ui/entry-editor-rich-text-toolbar-support.tsx:5`
- `apps/example-cms/src/ui/entry-editor-story-canvas-assets-support.tsx:6`
- `apps/example-cms/src/ui/entry-editor-story-canvas-fields-support.tsx:7`
- `apps/example-cms/src/ui/entry-editor-story-canvas-support.tsx:7`
- `apps/example-cms/src/ui/overview-panels-support.tsx:10`
- `apps/example-cms/src/ui/rich-text-editor/transactions-editor-adapter-render.ts:5`

### `typescript/no-unsafe-type-assertion`

#### EH-140: closest runs on the runtime Element resolved from the selection node.

**Locations:**

- `apps/example-cms/src/ui/rich-text-editor/transactions-editor-adapter-support.ts:151`

#### EH-141: fetch requires AbortSignal; generated clients pass the runtime signal.

**Locations:**

- `apps/example-cms/src/generated/headless-openapi-client-runtime-transport.ts:29`
- `apps/example-cms/src/generated/management-openapi-client-runtime-transport.ts:29`
- `apps/public-blog/src/generated/headless-openapi-client-runtime-transport.ts:29`
- `scripts/openapi-client-generator/runtime-template.ts:113`

#### EH-142: list item filtering preserves list-item node shapes within the editor document.

**Locations:**

- `apps/example-cms/src/ui/rich-text-editor/transactions-list-command-handlers.ts:69`

#### EH-143: list replacement preserves list node shape after item removal.

**Locations:**

- `apps/example-cms/src/ui/rich-text-editor/transactions-list-command-handlers.ts:65`

#### EH-144: MutationObserver.observe requires Node; the editable host is a runtime HTMLElement.

**Locations:**

- `apps/example-cms/src/ui/rich-text-editor/browser-adapter.ts:96`

#### EH-145: OpenAPI schema objects are validated as non-null objects before use.

**Locations:**

- `scripts/openapi-client-generator/component-schema-names.ts:12`

#### EH-146: paragraph children inherit inline nodes from the lifted block root.

**Locations:**

- `apps/example-cms/src/ui/rich-text-editor/transactions-list-command-handlers.ts:229`

#### EH-147: ReadonlyEditableHost is a Pick view of the editable div passed at runtime.

**Locations:**

- `apps/example-cms/src/ui/rich-text-editor/transactions-editor-adapter-support.ts:88`

#### EH-148: restoreSelectionRange reads selection anchors from the runtime editable host.

**Locations:**

- `apps/example-cms/src/ui/rich-text-editor/browser-adapter.ts:101`

#### EH-149: RichText.toJson returns a JSON-compatible object validated by the CMS schema boundary.

**Locations:**

- `apps/example-cms/src/domain/seed.ts:31`

#### EH-150: synchronizeSelectionState queries the runtime editable host for the current DOM selection.

**Locations:**

- `apps/example-cms/src/ui/rich-text-editor/browser-adapter.ts:126`

#### EH-151: Web APIs require AbortSignal; transport callers always pass the real signal.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-readonly-types.ts:23`

#### EH-152: Web APIs require Request; transport callers always pass the real request.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-readonly-types.ts:28`

### `typescript/prefer-readonly-parameter-types`

#### EH-153: action log must remain mutable for assertions.

**Locations:**

- `packages/nearly-headless-cms/test/contract/authorization-expansion-support.ts:60`
- `packages/nearly-headless-cms/test/contract/authorization-expansion.test.ts:8`
- `packages/nearly-headless-cms/test/contract/authorization-expansion.test.ts:38`
- `packages/nearly-headless-cms/test/contract/authorization-expansion.test.ts:63`
- `packages/nearly-headless-cms/test/contract/authorization-expansion.test.ts:98`

#### EH-154: assignment states include mutable entry value maps.

**Locations:**

- `apps/example-cms/src/management-image-assignment-support.ts:27`
- `apps/example-cms/src/management-image-assignment-support.ts:29`

#### EH-155: batch mutations are built from mutable entry write tokens.

**Locations:**

- `apps/example-cms/src/management-cascade-deletions.ts:9`
- `apps/example-cms/src/management-cascade-deletions.ts:23`

#### EH-156: Bun.spawn requires a mutable string command argv.

**Locations:**

- `scripts/release.ts:19`

#### EH-157: byte buffers are passed to Bun.write without retaining references.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-support.ts:264`

#### EH-158: CmsError and Effect parameters cannot satisfy deep readonly while preserving Schema narrowing in this module.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-response.ts:40`

#### EH-159: CmsError tagged unions are inspected via Schema.is without mutation.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-response.ts:67`
- `packages/nearly-headless-cms/src/http/http-transport-response.ts:77`
- `packages/nearly-headless-cms/src/http/http-transport-response.ts:90`
- `packages/nearly-headless-cms/src/http/http-transport-response.ts:100`
- `packages/nearly-headless-cms/src/http/http-transport-response.ts:110`
- `packages/nearly-headless-cms/src/http/http-transport-response.ts:120`
- `packages/nearly-headless-cms/src/http/http-transport-response.ts:138`

#### EH-160: comment submission bodies are validated as loosely typed JSON records.

**Locations:**

- `apps/example-cms/src/delivery-comment-submission-support.ts:178`

#### EH-161: conflict resolution callbacks receive mutable draft value maps.

**Locations:**

- `apps/example-cms/src/ui/entry-editor-conflict-panel.tsx:16`
- `apps/example-cms/src/ui/entry-editor-conflict-panel.tsx:69`

#### EH-162: create results use CMS mutation response union shapes.

**Locations:**

- `apps/example-cms/src/ui/content-list-support.ts:56`

#### EH-163: deniedAction.current is mutated to simulate authorization denial.

**Locations:**

- `packages/nearly-headless-cms/test/contract/authorization-expansion.test.ts:10`

#### EH-164: discovery routes read configured operations without mutation.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-preflight-support.ts:46`

#### EH-165: DOM selection nodes are inspected without retaining references.

**Locations:**

- `apps/example-cms/src/ui/rich-text-editor/transactions-editor-adapter-support.ts:130`
- `apps/example-cms/src/ui/rich-text-editor/transactions-editor-adapter-support.ts:145`

#### EH-166: DOM spans are mutated while applying rich-text marks.

**Locations:**

- `apps/example-cms/src/ui/rich-text-editor/transactions-editor-adapter-render.ts:17`

#### EH-167: DOM spans are mutated while assigning editor selection indices.

**Locations:**

- `apps/example-cms/src/ui/rich-text-editor/transactions-editor-adapter-render.ts:31`

#### EH-168: DOM text spans are read while mapping native selection offsets.

**Locations:**

- `apps/example-cms/src/ui/rich-text-editor/transactions-editor-adapter-support.ts:159`

#### EH-169: editable hosts are mutated while restoring native selection ranges.

**Locations:**

- `apps/example-cms/src/ui/rich-text-editor/transactions-editor-adapter-selection.ts:50`

#### EH-170: editable hosts are queried for live native selection state.

**Locations:**

- `apps/example-cms/src/ui/rich-text-editor/transactions-editor-adapter-selection.ts:41`

#### EH-171: editable hosts are queried while synchronizing editor selection state.

**Locations:**

- `apps/example-cms/src/ui/rich-text-editor/transactions-editor-adapter-selection.ts:84`

#### EH-172: Effect programs are executed by runOperationInterruptibly without mutation.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-handler-support.ts:138`

#### EH-173: Effect programs are executed by runPromise without mutation.

**Locations:**

- `packages/nearly-headless-cms/test/contract/authorization-expansion-support.ts:58`
- `packages/nearly-headless-cms/test/filesystem/filesystem-persistence-scenarios.ts:192`
- `packages/nearly-headless-cms/test/filesystem/filesystem-persistence-writer-scenarios.ts:20`
- `packages/nearly-headless-cms/test/filesystem/filesystem-persistence-writer-scenarios.ts:30`
- `packages/nearly-headless-cms/test/integration/cms-service.test.ts:38`
- `packages/nearly-headless-cms/test/integration/definition-lifecycle.test.ts:16`
- `packages/nearly-headless-cms/test/integration/definition-lifecycle.test.ts:22`
- `packages/nearly-headless-cms/test/integration/definition-lifecycle.test.ts:28`
- `packages/nearly-headless-cms/test/integration/entry-history.test.ts:11`

#### EH-174: Effect programs are executed, not mutated, by runPromise.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-response.ts:219`

#### EH-175: Effect programs are mapped without mutation.

**Locations:**

- `apps/example-cms/src/generated/management-client.ts:258`

#### EH-176: generated operation inputs include platform types that cannot satisfy deep readonly.

**Locations:**

- `apps/example-cms/src/generated/headless-openapi-client-runtime-transport.ts:18`
- `apps/example-cms/src/generated/management-openapi-client-runtime-transport.ts:18`
- `apps/public-blog/src/generated/headless-openapi-client-runtime-transport.ts:18`
- `scripts/openapi-client-generator/source-file-builders.ts:71`

#### EH-177: handler Options includes requestIdentifier callbacks.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-handler.ts:131`

#### EH-178: ingest content may be a Uint8Array or Effect Stream consumed during commit.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-support.ts:71`
- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-support.ts:131`

#### EH-179: Layer values are provided to runPromise without mutation.

**Locations:**

- `packages/nearly-headless-cms/test/filesystem/filesystem-persistence-scenarios.ts:190`
- `packages/nearly-headless-cms/test/filesystem/filesystem-persistence-writer-scenarios.ts:18`
- `packages/nearly-headless-cms/test/filesystem/filesystem-persistence-writer-scenarios.ts:28`

#### EH-180: multipart errors are inspected via instanceof and Predicate.isTagged without mutation.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-request-parsing-support.ts:146`

#### EH-181: multipart errors are inspected via Predicate.isTagged without mutation.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-request-parsing-support.ts:155`

#### EH-182: multipart file parts expose mutable content streams for staging writes.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-request-parsing-support.ts:180`

#### EH-183: multipart state is mutated while parsing asset parts.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-request-parsing-support.ts:120`

#### EH-184: mutable assetIds out-param is bundled in input interface.

**Locations:**

- `packages/nearly-headless-cms/src/cms-entry-references-support.ts:77`

#### EH-185: mutable issues and result out-params are bundled in input interface.

**Locations:**

- `packages/nearly-headless-cms/src/content-definition-entry-validation.ts:168`
- `packages/nearly-headless-cms/src/content-definition-entry-validation.ts:192`
- `packages/nearly-headless-cms/src/content-definition-entry-validation.ts:220`
- `packages/nearly-headless-cms/src/content-definition-entry-validation.ts:232`
- `packages/nearly-headless-cms/src/content-definition-entry-validation.ts:247`
- `packages/nearly-headless-cms/src/content-definition-entry-validation.ts:262`

#### EH-186: mutable issues out-param is bundled in input interface.

**Locations:**

- `packages/nearly-headless-cms/src/content-definition-entry-validation.ts:78`
- `packages/nearly-headless-cms/src/content-definition-entry-validation.ts:97`

#### EH-187: mutable listResult out-param is bundled in input interface.

**Locations:**

- `packages/nearly-headless-cms/src/content-definition-entry-validation.ts:133`
- `packages/nearly-headless-cms/src/content-definition-entry-validation.ts:159`

#### EH-188: mutable out-params are bundled in input interface.

**Locations:**

- `packages/nearly-headless-cms/src/cms-entry-references-support.ts:109`
- `packages/nearly-headless-cms/src/cms-entry-references-support.ts:122`
- `packages/nearly-headless-cms/src/cms-entry-references-support.ts:137`
- `packages/nearly-headless-cms/src/cms-entry-references-support.ts:151`

#### EH-189: mutable projected out-param is bundled in input interface.

**Locations:**

- `packages/nearly-headless-cms/src/entry-query-projection.ts:22`

#### EH-190: mutable relationships out-param is bundled in input interface.

**Locations:**

- `packages/nearly-headless-cms/src/cms-entry-references-support.ts:88`

#### EH-191: mutable values out-param is bundled in input interface.

**Locations:**

- `packages/nearly-headless-cms/src/cms-entry-expansion-field-group-support.ts:46`
- `packages/nearly-headless-cms/src/cms-entry-expansion-field-group-support.ts:81`
- `packages/nearly-headless-cms/src/cms-entry-expansion-relationship-support.ts:118`
- `packages/nearly-headless-cms/src/cms-entry-references-support.ts:171`

#### EH-192: mutation receipts use discriminated union shapes from CMS operations.

**Locations:**

- `apps/example-cms/src/delivery-comment-submission-support.ts:101`

#### EH-193: OpenAPI operation descriptors are read while building Effect HTTP API declarations.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-api.ts:120`
- `packages/nearly-headless-cms/src/http/http-api.ts:125`
- `packages/nearly-headless-cms/src/http/http-api.ts:129`
- `packages/nearly-headless-cms/src/http/http-api.ts:134`

#### EH-194: OpenAPI operation descriptors are read while building path maps.

**Locations:**

- `packages/nearly-headless-cms/src/http/open-api-management-paths.ts:90`
- `packages/nearly-headless-cms/src/http/open-api-management-paths.ts:100`
- `packages/nearly-headless-cms/src/http/open-api.ts:28`
- `packages/nearly-headless-cms/src/http/open-api.ts:48`
- `packages/nearly-headless-cms/src/http/open-api.ts:58`

#### EH-195: OpenAPI routes read configured operations without mutation.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-preflight-support.ts:72`
- `packages/nearly-headless-cms/src/http/http-transport-preflight-support.ts:74`

#### EH-196: OperationFetchRequest carries optional readonly abort signal bridge fields.

**Locations:**

- `apps/example-cms/src/generated/headless-openapi-client-runtime-transport.ts:106`
- `apps/example-cms/src/generated/management-openapi-client-runtime-transport.ts:106`
- `apps/public-blog/src/generated/headless-openapi-client-runtime-transport.ts:106`
- `scripts/openapi-client-generator/runtime-template.ts:186`

#### EH-197: OperationSchema values include Effect Schema classes that are not deeply readonly.

**Locations:**

- `apps/example-cms/src/delivery-support.ts:156`

#### EH-198: path parameter schemas include Effect Schema classes that are not deeply readonly.

**Locations:**

- `apps/example-cms/src/delivery-support.ts:158`

#### EH-199: React callbacks receive mutable draft value maps from the editor.

**Locations:**

- `apps/example-cms/src/ui/entry-editor-controller-mutations.ts:25`
- `apps/example-cms/src/ui/entry-editor-controller-mutations.ts:27`
- `apps/example-cms/src/ui/entry-editor-mutations.ts:61`
- `apps/example-cms/src/ui/entry-editor-mutations.ts:129`

#### EH-200: React Query mutation and query objects expose mutable status while rendering history.

**Locations:**

- `apps/example-cms/src/ui/entry-editor-history-panel-body.tsx:50`

#### EH-201: React Query results expose mutable status fields while rendering revision details.

**Locations:**

- `apps/example-cms/src/ui/entry-editor-revision-inspection.tsx:42`

#### EH-202: route handlers inspect operation metadata without mutating configured operations.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-delivery-routes.ts:18`
- `packages/nearly-headless-cms/src/http/http-transport-delivery-routes.ts:53`
- `packages/nearly-headless-cms/src/http/http-transport-handler.ts:52`
- `packages/nearly-headless-cms/src/http/http-transport-handler.ts:54`

#### EH-203: save results may return entry values directly or nested under entry.

**Locations:**

- `apps/example-cms/src/ui/entry-editor-support.ts:22`

#### EH-204: spawn options include mutable environment maps.

**Locations:**

- `scripts/release.ts:21`

#### EH-205: staging writer state is mutated while finalizing blob writes.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-support.ts:159`

#### EH-206: stored asset bytes are read without mutation when serving range requests.

**Locations:**

- `apps/example-cms/src/delivery-public-asset-response-support.ts:57`

#### EH-207: SynchronizedRef state is mutated while persisting ingested assets.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-services.ts:218`

#### EH-208: Uint8Array chunks are returned without mutation.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-response.ts:157`

### `unicorn/no-array-sort`

#### EH-209: registry keys are sorted in place before code assignment.

**Locations:**

- `scripts/escape-hatches.ts:14`

### `unicorn/prefer-number-coercion`

#### EH-214: registry code numbers are parsed from fixed-width labels.

**Locations:**

- `scripts/escape-hatches.ts:16`

### `unicorn/prefer-ternary`

#### EH-215: registry defaults keep explicit branch justifications.

**Locations:**

- `scripts/escape-hatches.ts:17`

## Code Index

- **EH-001** (`@ts-expect-error`): Arbitrary private subpaths are not public package exports.
- **EH-002** (`effecttsgo/async-function`): Asset staging finalization coordinates Bun writer flush and fsync boundaries.
- **EH-003** (`effecttsgo/async-function`): Atomic persistence coordinates Bun and node filesystem promises.
- **EH-004** (`effecttsgo/async-function`): baseline bytes are read through Promise-based Bun filesystem APIs.
- **EH-005** (`effecttsgo/async-function`): Bun filesystem handles expose Promise-based synchronization boundaries.
- **EH-006** (`effecttsgo/async-function`): Bun lifecycle hook performs async cleanup.
- **EH-007** (`effecttsgo/async-function`): Bun lifecycle hook performs async system setup.
- **EH-008** (`effecttsgo/async-function`): Bun WebView evaluation and sleep are Promise-based platform lifecycle operations.
- **EH-009** (`effecttsgo/async-function`): Bun's test runner requires a Promise-returning lifecycle callback.
- **EH-010** (`effecttsgo/async-function`): cache invalidation must remain sequential.
- **EH-011** (`effecttsgo/async-function`): Cleanup intentionally preserves sequential filesystem ordering.
- **EH-012** (`effecttsgo/async-function`): CLI bootstrap reads package.json before any Effect program exists.
- **EH-013** (`effecttsgo/async-function`): CLI command runner awaits process completion.
- **EH-014** (`effecttsgo/async-function`): CLI readiness polling requires awaited retries.
- **EH-015** (`effecttsgo/async-function`): definition routes delegate to catalog and migration handlers sequentially.
- **EH-016** (`effecttsgo/async-function`): deletion sequence requires awaited server state.
- **EH-017** (`effecttsgo/async-function`): Diagnostic inspection is a read-only filesystem boundary.
- **EH-018** (`effecttsgo/async-function`): durable blob commits use Promise-based filesystem synchronization.
- **EH-019** (`effecttsgo/async-function`): entry creation sequences dependent requests.
- **EH-020** (`effecttsgo/async-function`): escape hatch registry CLI uses async filesystem IO.
- **EH-021** (`effecttsgo/async-function`): FileHandle.write is Promise-based and must remain ordered.
- **EH-022** (`effecttsgo/async-function`): fingerprint validation awaits interruptible Effect execution.
- **EH-023** (`effecttsgo/async-function`): fixture setup intentionally awaits native filesystem and CMS startup.
- **EH-024** (`effecttsgo/async-function`): fixture teardown awaits native filesystem cleanup.
- **EH-025** (`effecttsgo/async-function`): generated clients expose a Promise-backed transport boundary; converting this callback to Effect would change the generated public client contract.
- **EH-026** (`effecttsgo/async-function`): generated clients expose a Promise-backed transport boundary.
- **EH-027** (`effecttsgo/async-function`): Guard creation requires sequential Bun filesystem operations.
- **EH-028** (`effecttsgo/async-function`): Handler is a Web-standard Promise<Response> callback.
- **EH-029** (`effecttsgo/async-function`): helper intentionally awaits a native HTTP promise.
- **EH-030** (`effecttsgo/async-function`): helper intentionally awaits native filesystem cleanup.
- **EH-031** (`effecttsgo/async-function`): helper intentionally awaits native HTTP promises.
- **EH-032** (`effecttsgo/async-function`): HTTP contract assertions intentionally await native promises.
- **EH-033** (`effecttsgo/async-function`): interruptible outcomes are awaited before routing continues.
- **EH-034** (`effecttsgo/async-function`): journey assertions compose awaited WebView navigation and evaluation.
- **EH-035** (`effecttsgo/async-function`): journey orchestration composes native WebView Promise operations.
- **EH-036** (`effecttsgo/async-function`): JSON loading uses Bun's asynchronous file API.
- **EH-037** (`effecttsgo/async-function`): Lock cleanup reads and removes a Bun filesystem record.
- **EH-038** (`effecttsgo/async-function`): Lock creation requires sequential Bun filesystem operations.
- **EH-039** (`effecttsgo/async-function`): Lock records are read through Bun's filesystem Promise API.
- **EH-040** (`effecttsgo/async-function`): multipart parsing is Promise-based and this helper is not a pipeable Effect API.
- **EH-041** (`effecttsgo/async-function`): parallel architecture scans use async file reads.
- **EH-042** (`effecttsgo/async-function`): parallel portability scans use async file reads.
- **EH-043** (`effecttsgo/async-function`): Persistence spans ordered atomic filesystem writes.
- **EH-044** (`effecttsgo/async-function`): qualification assertions compose awaited WebView navigation and evaluation.
- **EH-045** (`effecttsgo/async-function`): React query callback awaits cache invalidation.
- **EH-046** (`effecttsgo/async-function`): React query callback awaits navigation.
- **EH-047** (`effecttsgo/async-function`): React query callback sequences invalidation before navigation.
- **EH-048** (`effecttsgo/async-function`): React query error callback awaits the latest server state.
- **EH-049** (`effecttsgo/async-function`): React query mutation is an intentional browser async boundary.
- **EH-050** (`effecttsgo/async-function`): React query mutation must bridge browser fetch.
- **EH-051** (`effecttsgo/async-function`): Recovery locking is a filesystem callback boundary.
- **EH-052** (`effecttsgo/async-function`): recursive acceptance retries compose native WebView Promise operations.
- **EH-053** (`effecttsgo/async-function`): recursive polling requires awaited retries.
- **EH-054** (`effecttsgo/async-function`): request handling awaits body parsing and Effect execution.
- **EH-055** (`effecttsgo/async-function`): request handling awaits route dispatch before returning a final response.
- **EH-056** (`effecttsgo/async-function`): Returned release callback closes the Bun filesystem guard.
- **EH-057** (`effecttsgo/async-function`): Root initialization coordinates ordered filesystem operations.
- **EH-058** (`effecttsgo/async-function`): route dispatch is a plain async helper, not a pipeable Effect API.
- **EH-059** (`effecttsgo/async-function`): route handlers await JSON body parsing before Effect execution.
- **EH-060** (`effecttsgo/async-function`): scenario intentionally awaits native HTTP promises.
- **EH-061** (`effecttsgo/async-function`): screenshot and filesystem APIs are Promise-based Bun platform operations.
- **EH-062** (`effecttsgo/async-function`): snapshot resolution awaits interruptible Effect execution before routing.
- **EH-063** (`effecttsgo/async-function`): Stale guard recovery reads and reclaims a Bun filesystem record.
- **EH-064** (`effecttsgo/async-function`): Stale lock recovery coordinates sequential Bun filesystem operations.
- **EH-065** (`effecttsgo/async-function`): the public Web handler contract returns a Promise<Response>.
- **EH-066** (`effecttsgo/async-function`): Web Request.arrayBuffer is Promise-based and this helper is not a pipeable Effect API.
- **EH-067** (`effecttsgo/async-function`): Writer lock creation is a sequential Bun filesystem boundary.
- **EH-068** (`effecttsgo/crypto-random-uuid`): browser UI labels need a synchronous local identifier.
- **EH-069** (`effecttsgo/crypto-random-uuid`): default request IDs are generated synchronously before Effect execution.
- **EH-070** (`effecttsgo/crypto-random-uuid`): lock acquisition is a synchronous token-generation step around Bun file operations.
- **EH-071** (`effecttsgo/crypto-random-uuid`): staging paths are built synchronously in Bun's filesystem bridge.
- **EH-072** (`effecttsgo/crypto-random-uuid`): staging paths are computed before the Effect stream starts and must remain synchronous.
- **EH-073** (`effecttsgo/crypto-random-uuid`): the management client accepts a synchronous idempotency key.
- **EH-074** (`effecttsgo/extends-native-error`): This transport-only error is converted to a CmsError before entering an Effect failure channel.
- **EH-075** (`effecttsgo/global-console`): acceptance completion is intentionally emitted to CLI stdout.
- **EH-076** (`effecttsgo/global-console`): acceptance progress is intentionally emitted to CLI stdout.
- **EH-077** (`effecttsgo/global-console`): escape hatch registry CLI reports to stdout and stderr.
- **EH-078** (`effecttsgo/global-console`): this script's contract is machine-readable CLI stdout.
- **EH-079** (`effecttsgo/global-fetch`): Browser mutation boundary is owned by the UI query client.
- **EH-080** (`effecttsgo/global-fetch`): CLI acceptance polling intentionally uses the platform fetch boundary.
- **EH-081** (`effecttsgo/global-fetch`): generated clients intentionally use the platform fetch boundary so callers can supply the browser or server runtime.
- **EH-082** (`effecttsgo/global-fetch-in-effect`): generated clients intentionally use the platform fetch boundary so callers can supply the browser or server runtime.
- **EH-083** (`effecttsgo/missing-pipeable-signature`): compileSnapshot is exported for typed internal call sites.
- **EH-084** (`effecttsgo/missing-pipeable-signature`): content list helper is intentionally a direct three-argument operation.
- **EH-085** (`effecttsgo/missing-pipeable-signature`): content list helper is intentionally a direct two-argument operation.
- **EH-086** (`effecttsgo/missing-pipeable-signature`): dual's generic overload is not inferred by the linter for this public helper.
- **EH-087** (`effecttsgo/missing-pipeable-signature`): editor transaction API is intentionally a direct two-argument operation.
- **EH-088** (`effecttsgo/missing-pipeable-signature`): JSON field helper is intentionally a direct two-argument operation.
- **EH-089** (`effecttsgo/missing-pipeable-signature`): local schema adapter is intentionally direct-call only.
- **EH-090** (`effecttsgo/missing-pipeable-signature`): multipart parsing is Promise-based and this helper is not a pipeable Effect API.
- **EH-091** (`effecttsgo/missing-pipeable-signature`): public serialize helper is not a pipeable Effect API.
- **EH-092** (`effecttsgo/missing-pipeable-signature`): Rich Text helpers are not pipeable Effect APIs.
- **EH-093** (`effecttsgo/missing-pipeable-signature`): route dispatch is a plain async helper, not a pipeable Effect API.
- **EH-094** (`effecttsgo/missing-pipeable-signature`): test helper is not a pipeable Effect API.
- **EH-095** (`effecttsgo/missing-pipeable-signature`): test JSON field helper is intentionally a direct two-argument operation.
- **EH-096** (`effecttsgo/missing-pipeable-signature`): test URL helper is intentionally a direct two-argument operation.
- **EH-097** (`effecttsgo/missing-pipeable-signature`): UI label helper is intentionally a direct two-argument operation.
- **EH-098** (`effecttsgo/missing-pipeable-signature`): UI value helper is intentionally a direct two-argument operation.
- **EH-099** (`effecttsgo/missing-pipeable-signature`): Web handler timeout wrapper is not a pipeable Effect API.
- **EH-100** (`effecttsgo/missing-pipeable-signature`): Web Request.arrayBuffer is Promise-based and this helper is not a pipeable Effect API.
- **EH-210** (`effecttsgo/node-builtin-import`): Baseline paths are test-runner setup paths; there is no Effect runtime involved in this Bun test.
- **EH-101** (`effecttsgo/node-builtin-import`): Bun does not provide a path manipulation API; these operations are platform-neutral string handling.
- **EH-211** (`effecttsgo/node-builtin-import`): Path joining is host-path setup for this filesystem integration test, outside the Effect service graph.
- **EH-102** (`effecttsgo/node-builtin-import`): Standalone CLI resolves repository paths before any Effect application exists.
- **EH-103** (`effecttsgo/node-builtin-import`): Temporary upload staging requires node fs primitives unavailable in the HTTP FileSystem abstraction.
- **EH-104** (`effecttsgo/node-builtin-import`): Temporary upload staging requires node os primitives unavailable in the HTTP FileSystem abstraction.
- **EH-105** (`effecttsgo/node-builtin-import`): Temporary upload staging requires node path primitives unavailable in the HTTP FileSystem abstraction.
- **EH-212** (`effecttsgo/node-builtin-import`): The test exercises the Bun filesystem adapter's on-disk behavior; these helpers have no Bun equivalent.
- **EH-106** (`effecttsgo/node-builtin-import`): This Bun adapter needs durable fsync/open and directory primitives unavailable in Effect's portable FileSystem layer.
- **EH-107** (`effecttsgo/prefer-schema-over-json`): request bodies are OpenAPI-generated unknown shapes and must be serialized using the browser JSON boundary.
- **EH-108** (`effecttsgo/run-effect-inside-effect`): bridge the abort callback into Promise.race.
- **EH-109** (`effecttsgo/run-effect-inside-effect`): interrupt the owned timer fiber during Web handler cleanup.
- **EH-110** (`effecttsgo/run-effect-inside-effect`): this Web handler owns a timer fiber outside the request Effect.
- **EH-111** (`effecttsgo/strict-effect-provide`): test entry point needs a fresh isolated layer per run.
- **EH-112** (`effecttsgo/strict-effect-provide`): test entry point needs a fresh isolated layer.
- **EH-113** (`eslint/func-style`): error status helpers are function declarations to keep CmsError Schema narrowing readable.
- **EH-114** (`eslint/max-lines`): escape hatch registry coordinates scan, sync, and render.
- **EH-115** (`eslint/max-lines`): generated transport runtime exceeds local module line budget.
- **EH-116** (`eslint/max-lines`): reference and projection helpers are intentionally colocated.
- **EH-117** (`eslint/max-lines`): validation helpers are intentionally colocated.
- **EH-118** (`eslint/max-lines-per-function`): escape hatch parsing and rendering are intentionally colocated.
- **EH-213** (`eslint/max-params`): escape hatch parsing bundles file, line, and context inputs.
- **EH-119** (`eslint/max-statements`): escape hatch registry coordinates sequential file updates.
- **EH-120** (`eslint/no-await-in-loop`): file scans and updates must preserve source order.
- **EH-121** (`eslint/no-continue`): registry assignment skips unresolved rule and code pairs.
- **EH-122** (`eslint/no-magic-numbers`): registry codes use fixed-width numeric padding.
- **EH-123** (`eslint/no-ternary`): generated fetch bridge keeps compact signal fallback.
- **EH-124** (`eslint/no-ternary`): registry formatting keeps compact comment labels.
- **EH-125** (`eslint/one-var`): helpers with readonly disables must stay as separate const declarations.
- **EH-126** (`eslint/one-var`): registry helpers keep related declarations grouped.
- **EH-127** (`eslint/require-unicode-regexp`): registry parsing uses ASCII comment markers only.
- **EH-128** (`eslint/sort-imports`): export route imports follow dependency grouping.
- **EH-129** (`eslint/sort-imports`): history panel imports follow UI dependency grouping.
- **EH-130** (`eslint/sort-vars`): generated runtime helpers are ordered for readability.
- **EH-131** (`eslint/sort-vars`): helper declaration order follows dependency order.
- **EH-132** (`eslint/sort-vars`): registry helpers follow parse, assign, and render order.
- **EH-133** (`eslint/sort-vars`): test constants follow scenario narrative order.
- **EH-134** (`no-await-in-loop`): checks intentionally run sequentially.
- **EH-135** (`no-await-in-loop`): cleanup must remain sequential.
- **EH-136** (`no-await-in-loop`): handlers must run sequentially until one matches.
- **EH-137** (`no-await-in-loop`): preserve ordered chunk writes.
- **EH-138** (`no-await-in-loop`): recursive cleanup must remain sequential.
- **EH-139** (`typescript/no-unnecessary-type-parameters`): React panel helpers preserve local prop aliases for component call sites.
- **EH-140** (`typescript/no-unsafe-type-assertion`): closest runs on the runtime Element resolved from the selection node.
- **EH-141** (`typescript/no-unsafe-type-assertion`): fetch requires AbortSignal; generated clients pass the runtime signal.
- **EH-142** (`typescript/no-unsafe-type-assertion`): list item filtering preserves list-item node shapes within the editor document.
- **EH-143** (`typescript/no-unsafe-type-assertion`): list replacement preserves list node shape after item removal.
- **EH-144** (`typescript/no-unsafe-type-assertion`): MutationObserver.observe requires Node; the editable host is a runtime HTMLElement.
- **EH-145** (`typescript/no-unsafe-type-assertion`): OpenAPI schema objects are validated as non-null objects before use.
- **EH-146** (`typescript/no-unsafe-type-assertion`): paragraph children inherit inline nodes from the lifted block root.
- **EH-147** (`typescript/no-unsafe-type-assertion`): ReadonlyEditableHost is a Pick view of the editable div passed at runtime.
- **EH-148** (`typescript/no-unsafe-type-assertion`): restoreSelectionRange reads selection anchors from the runtime editable host.
- **EH-149** (`typescript/no-unsafe-type-assertion`): RichText.toJson returns a JSON-compatible object validated by the CMS schema boundary.
- **EH-150** (`typescript/no-unsafe-type-assertion`): synchronizeSelectionState queries the runtime editable host for the current DOM selection.
- **EH-151** (`typescript/no-unsafe-type-assertion`): Web APIs require AbortSignal; transport callers always pass the real signal.
- **EH-152** (`typescript/no-unsafe-type-assertion`): Web APIs require Request; transport callers always pass the real request.
- **EH-153** (`typescript/prefer-readonly-parameter-types`): action log must remain mutable for assertions.
- **EH-154** (`typescript/prefer-readonly-parameter-types`): assignment states include mutable entry value maps.
- **EH-155** (`typescript/prefer-readonly-parameter-types`): batch mutations are built from mutable entry write tokens.
- **EH-156** (`typescript/prefer-readonly-parameter-types`): Bun.spawn requires a mutable string command argv.
- **EH-157** (`typescript/prefer-readonly-parameter-types`): byte buffers are passed to Bun.write without retaining references.
- **EH-158** (`typescript/prefer-readonly-parameter-types`): CmsError and Effect parameters cannot satisfy deep readonly while preserving Schema narrowing in this module.
- **EH-159** (`typescript/prefer-readonly-parameter-types`): CmsError tagged unions are inspected via Schema.is without mutation.
- **EH-160** (`typescript/prefer-readonly-parameter-types`): comment submission bodies are validated as loosely typed JSON records.
- **EH-161** (`typescript/prefer-readonly-parameter-types`): conflict resolution callbacks receive mutable draft value maps.
- **EH-162** (`typescript/prefer-readonly-parameter-types`): create results use CMS mutation response union shapes.
- **EH-163** (`typescript/prefer-readonly-parameter-types`): deniedAction.current is mutated to simulate authorization denial.
- **EH-164** (`typescript/prefer-readonly-parameter-types`): discovery routes read configured operations without mutation.
- **EH-165** (`typescript/prefer-readonly-parameter-types`): DOM selection nodes are inspected without retaining references.
- **EH-166** (`typescript/prefer-readonly-parameter-types`): DOM spans are mutated while applying rich-text marks.
- **EH-167** (`typescript/prefer-readonly-parameter-types`): DOM spans are mutated while assigning editor selection indices.
- **EH-168** (`typescript/prefer-readonly-parameter-types`): DOM text spans are read while mapping native selection offsets.
- **EH-169** (`typescript/prefer-readonly-parameter-types`): editable hosts are mutated while restoring native selection ranges.
- **EH-170** (`typescript/prefer-readonly-parameter-types`): editable hosts are queried for live native selection state.
- **EH-171** (`typescript/prefer-readonly-parameter-types`): editable hosts are queried while synchronizing editor selection state.
- **EH-172** (`typescript/prefer-readonly-parameter-types`): Effect programs are executed by runOperationInterruptibly without mutation.
- **EH-173** (`typescript/prefer-readonly-parameter-types`): Effect programs are executed by runPromise without mutation.
- **EH-174** (`typescript/prefer-readonly-parameter-types`): Effect programs are executed, not mutated, by runPromise.
- **EH-175** (`typescript/prefer-readonly-parameter-types`): Effect programs are mapped without mutation.
- **EH-176** (`typescript/prefer-readonly-parameter-types`): generated operation inputs include platform types that cannot satisfy deep readonly.
- **EH-177** (`typescript/prefer-readonly-parameter-types`): handler Options includes requestIdentifier callbacks.
- **EH-178** (`typescript/prefer-readonly-parameter-types`): ingest content may be a Uint8Array or Effect Stream consumed during commit.
- **EH-179** (`typescript/prefer-readonly-parameter-types`): Layer values are provided to runPromise without mutation.
- **EH-180** (`typescript/prefer-readonly-parameter-types`): multipart errors are inspected via instanceof and Predicate.isTagged without mutation.
- **EH-181** (`typescript/prefer-readonly-parameter-types`): multipart errors are inspected via Predicate.isTagged without mutation.
- **EH-182** (`typescript/prefer-readonly-parameter-types`): multipart file parts expose mutable content streams for staging writes.
- **EH-183** (`typescript/prefer-readonly-parameter-types`): multipart state is mutated while parsing asset parts.
- **EH-184** (`typescript/prefer-readonly-parameter-types`): mutable assetIds out-param is bundled in input interface.
- **EH-185** (`typescript/prefer-readonly-parameter-types`): mutable issues and result out-params are bundled in input interface.
- **EH-186** (`typescript/prefer-readonly-parameter-types`): mutable issues out-param is bundled in input interface.
- **EH-187** (`typescript/prefer-readonly-parameter-types`): mutable listResult out-param is bundled in input interface.
- **EH-188** (`typescript/prefer-readonly-parameter-types`): mutable out-params are bundled in input interface.
- **EH-189** (`typescript/prefer-readonly-parameter-types`): mutable projected out-param is bundled in input interface.
- **EH-190** (`typescript/prefer-readonly-parameter-types`): mutable relationships out-param is bundled in input interface.
- **EH-191** (`typescript/prefer-readonly-parameter-types`): mutable values out-param is bundled in input interface.
- **EH-192** (`typescript/prefer-readonly-parameter-types`): mutation receipts use discriminated union shapes from CMS operations.
- **EH-193** (`typescript/prefer-readonly-parameter-types`): OpenAPI operation descriptors are read while building Effect HTTP API declarations.
- **EH-194** (`typescript/prefer-readonly-parameter-types`): OpenAPI operation descriptors are read while building path maps.
- **EH-195** (`typescript/prefer-readonly-parameter-types`): OpenAPI routes read configured operations without mutation.
- **EH-196** (`typescript/prefer-readonly-parameter-types`): OperationFetchRequest carries optional readonly abort signal bridge fields.
- **EH-197** (`typescript/prefer-readonly-parameter-types`): OperationSchema values include Effect Schema classes that are not deeply readonly.
- **EH-198** (`typescript/prefer-readonly-parameter-types`): path parameter schemas include Effect Schema classes that are not deeply readonly.
- **EH-199** (`typescript/prefer-readonly-parameter-types`): React callbacks receive mutable draft value maps from the editor.
- **EH-200** (`typescript/prefer-readonly-parameter-types`): React Query mutation and query objects expose mutable status while rendering history.
- **EH-201** (`typescript/prefer-readonly-parameter-types`): React Query results expose mutable status fields while rendering revision details.
- **EH-202** (`typescript/prefer-readonly-parameter-types`): route handlers inspect operation metadata without mutating configured operations.
- **EH-203** (`typescript/prefer-readonly-parameter-types`): save results may return entry values directly or nested under entry.
- **EH-204** (`typescript/prefer-readonly-parameter-types`): spawn options include mutable environment maps.
- **EH-205** (`typescript/prefer-readonly-parameter-types`): staging writer state is mutated while finalizing blob writes.
- **EH-206** (`typescript/prefer-readonly-parameter-types`): stored asset bytes are read without mutation when serving range requests.
- **EH-207** (`typescript/prefer-readonly-parameter-types`): SynchronizedRef state is mutated while persisting ingested assets.
- **EH-208** (`typescript/prefer-readonly-parameter-types`): Uint8Array chunks are returned without mutation.
- **EH-209** (`unicorn/no-array-sort`): registry keys are sorted in place before code assignment.
- **EH-214** (`unicorn/prefer-number-coercion`): registry code numbers are parsed from fixed-width labels.
- **EH-215** (`unicorn/prefer-ternary`): registry defaults keep explicit branch justifications.
