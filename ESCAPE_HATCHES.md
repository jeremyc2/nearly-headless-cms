# Escape Hatches

This document tracks every lint and type-check escape hatch in the repository.

We prefer strict linting and type-checking. Each escape hatch below is intentional,
documented, and assigned a stable code for review and remediation.

## Conventions

When you must disable a rule:

1. Prefer fixing the underlying issue over adding an escape hatch.
2. Never use file-wide `// oxlint-disable` or `/* oxlint-disable */`; use `// oxlint-disable-next-line` on the specific line instead.
3. Every escape hatch must include both a **code** and a **justification** in this format:

   ```ts
   // oxlint-disable-next-line <rule> -- [EH-042] <justification>
   ```

   ```ts
   // @ts-expect-error [EH-042] <justification>
   ```

4. Regenerate this file with `bun run scripts/escape-hatches.ts sync` when adding or changing an escape hatch.
5. Run `bun run check:escape-hatches` to verify every escape hatch has a code and this file exists.

## Code Index

Sorted by escape-hatch code (`EH-###`).

- **EH-001** (`@ts-expect-error`): Arbitrary private subpaths are not public package exports.
- **EH-002** (`effecttsgo/abort-controller-in-effect`): transport shutdown keeps one shared AbortController for in-flight Web requests.
- **EH-003** (`effecttsgo/async-function`): Asset staging finalization coordinates Bun writer flush and fsync boundaries.
- **EH-004** (`effecttsgo/async-function`): Atomic persistence coordinates Bun and node filesystem promises.
- **EH-005** (`effecttsgo/async-function`): axe acceptance scans compose awaited WebView navigation and evaluation.
- **EH-006** (`effecttsgo/async-function`): baseline bytes are read through Promise-based Bun filesystem APIs.
- **EH-007** (`effecttsgo/async-function`): Bun filesystem handles expose Promise-based synchronization boundaries.
- **EH-008** (`effecttsgo/async-function`): Bun lifecycle hook performs async cleanup.
- **EH-009** (`effecttsgo/async-function`): Bun lifecycle hook performs async system setup.
- **EH-010** (`effecttsgo/async-function`): Bun WebView evaluation and sleep are Promise-based platform lifecycle operations.
- **EH-011** (`effecttsgo/async-function`): Bun's test runner requires a Promise-returning lifecycle callback.
- **EH-012** (`effecttsgo/async-function`): cache invalidation must remain sequential.
- **EH-013** (`effecttsgo/async-function`): Cleanup intentionally preserves sequential filesystem ordering.
- **EH-014** (`effecttsgo/async-function`): CLI bootstrap reads package.json before any Effect program exists.
- **EH-015** (`effecttsgo/async-function`): CLI command runner awaits process completion.
- **EH-016** (`effecttsgo/async-function`): CLI readiness polling requires awaited retries.
- **EH-017** (`effecttsgo/async-function`): conflict preparation follows controlled input setup despite alphabetical ordering.
- **EH-018** (`effecttsgo/async-function`): controlled input updates precede conflict preparation despite alphabetical ordering.
- **EH-019** (`effecttsgo/async-function`): definition routes delegate to catalog and migration handlers sequentially.
- **EH-020** (`effecttsgo/async-function`): deletion sequence requires awaited server state.
- **EH-021** (`effecttsgo/async-function`): Diagnostic inspection is a read-only filesystem boundary.
- **EH-022** (`effecttsgo/async-function`): durable blob commits use Promise-based filesystem synchronization.
- **EH-023** (`effecttsgo/async-function`): editor navigation depends on waitUntilExpression despite alphabetical ordering.
- **EH-024** (`effecttsgo/async-function`): entry creation sequences dependent requests.
- **EH-026** (`effecttsgo/async-function`): escape hatch registry CLI uses async filesystem IO.
- **EH-027** (`effecttsgo/async-function`): escape hatch registry helpers are intentionally direct-call only.
- **EH-028** (`effecttsgo/async-function`): FileHandle.write is Promise-based and must remain ordered.
- **EH-029** (`effecttsgo/async-function`): fingerprint validation awaits interruptible Effect execution.
- **EH-030** (`effecttsgo/async-function`): fixture setup intentionally awaits native filesystem and CMS startup.
- **EH-031** (`effecttsgo/async-function`): fixture teardown awaits native filesystem cleanup.
- **EH-032** (`effecttsgo/async-function`): generated clients expose a Promise-backed transport boundary; converting this callback to Effect would change the generated public client contract.
- **EH-033** (`effecttsgo/async-function`): Guard creation requires sequential Bun filesystem operations.
- **EH-034** (`effecttsgo/async-function`): Handler is a Web-standard Promise<Response> callback.
- **EH-035** (`effecttsgo/async-function`): helper intentionally awaits a native HTTP promise.
- **EH-036** (`effecttsgo/async-function`): helper intentionally awaits native filesystem cleanup.
- **EH-037** (`effecttsgo/async-function`): helper intentionally awaits native HTTP promises.
- **EH-038** (`effecttsgo/async-function`): HTTP contract assertions intentionally await native promises.
- **EH-039** (`effecttsgo/async-function`): interactive visual scenarios reset mutated Example CMS fixture entries.
- **EH-040** (`effecttsgo/async-function`): interruptible outcomes are awaited before routing continues.
- **EH-041** (`effecttsgo/async-function`): journey assertions compose awaited WebView navigation and evaluation.
- **EH-042** (`effecttsgo/async-function`): journey orchestration composes native WebView Promise operations.
- **EH-043** (`effecttsgo/async-function`): journey orchestration follows helper dependency order despite alphabetical ordering.
- **EH-044** (`effecttsgo/async-function`): JSON loading uses Bun's asynchronous file API.
- **EH-045** (`effecttsgo/async-function`): lifecycle wrapper is a Web-standard Promise<Response> callback.
- **EH-046** (`effecttsgo/async-function`): Lock cleanup reads and removes a Bun filesystem record.
- **EH-047** (`effecttsgo/async-function`): Lock creation requires sequential Bun filesystem operations.
- **EH-048** (`effecttsgo/async-function`): Lock records are read through Bun's filesystem Promise API.
- **EH-049** (`effecttsgo/async-function`): multipart parsing is Promise-based and this helper is not a pipeable Effect API.
- **EH-050** (`effecttsgo/async-function`): parallel architecture scans use async file reads.
- **EH-051** (`effecttsgo/async-function`): parallel portability scans use async file reads.
- **EH-052** (`effecttsgo/async-function`): Persistence spans ordered atomic filesystem writes.
- **EH-053** (`effecttsgo/async-function`): qualification assertions compose awaited WebView navigation and evaluation.
- **EH-054** (`effecttsgo/async-function`): React query callback awaits cache invalidation.
- **EH-055** (`effecttsgo/async-function`): React query callback awaits navigation.
- **EH-056** (`effecttsgo/async-function`): React query callback sequences invalidation before navigation.
- **EH-057** (`effecttsgo/async-function`): React query error callback awaits the latest server state.
- **EH-058** (`effecttsgo/async-function`): React query mutation is an intentional browser async boundary.
- **EH-059** (`effecttsgo/async-function`): React query mutation must bridge browser fetch.
- **EH-060** (`effecttsgo/async-function`): Recovery locking is a filesystem callback boundary.
- **EH-061** (`effecttsgo/async-function`): recursive acceptance retries compose native WebView Promise operations.
- **EH-062** (`effecttsgo/async-function`): recursive polling requires awaited retries.
- **EH-063** (`effecttsgo/async-function`): request handling awaits body parsing and Effect execution.
- **EH-064** (`effecttsgo/async-function`): request handling awaits route dispatch before returning a final response.
- **EH-065** (`effecttsgo/async-function`): Returned release callback closes the Bun filesystem guard.
- **EH-066** (`effecttsgo/async-function`): Root initialization coordinates ordered filesystem operations.
- **EH-067** (`effecttsgo/async-function`): route dispatch is a plain async helper, not a pipeable Effect API.
- **EH-068** (`effecttsgo/async-function`): route handlers await JSON body parsing before Effect execution.
- **EH-069** (`effecttsgo/async-function`): scenario intentionally awaits native HTTP promises.
- **EH-070** (`effecttsgo/async-function`): screenshot and filesystem APIs are Promise-based Bun platform operations.
- **EH-071** (`effecttsgo/async-function`): slow consumer reads intentionally await Bun.sleep between stream chunks; readNextChunk closes over reader.
- **EH-072** (`effecttsgo/async-function`): snapshot resolution awaits interruptible Effect execution before routing.
- **EH-073** (`effecttsgo/async-function`): socket acceptance polling coordinates shutdown timing outside Effect.
- **EH-074** (`effecttsgo/async-function`): Stale guard recovery reads and reclaims a Bun filesystem record.
- **EH-075** (`effecttsgo/async-function`): Stale lock recovery coordinates sequential Bun filesystem operations.
- **EH-076** (`effecttsgo/async-function`): the public Web handler contract returns a Promise<Response>.
- **EH-077** (`effecttsgo/async-function`): validation screenshot normalization runs after React settles in the test finalize hook.
- **EH-078** (`effecttsgo/async-function`): visual baseline polling composes sequential WebView evaluation and sleep.
- **EH-079** (`effecttsgo/async-function`): visual baseline preparation composes awaited WebView navigation and evaluation.
- **EH-080** (`effecttsgo/async-function`): visual baseline setup prepares invalid draft publication state through the management API.
- **EH-081** (`effecttsgo/async-function`): visual baseline setup queries the live Example CMS management API.
- **EH-082** (`effecttsgo/async-function`): visual baseline setup reads the live Example CMS management API.
- **EH-083** (`effecttsgo/async-function`): visual baseline setup writes through the live Example CMS management API.
- **EH-084** (`effecttsgo/async-function`): Web Request.arrayBuffer is Promise-based and this helper is not a pipeable Effect API.
- **EH-085** (`effecttsgo/async-function`): WebView readiness polling composes awaited evaluation and sleep.
- **EH-086** (`effecttsgo/async-function`): Writer lock creation is a sequential Bun filesystem boundary.
- **EH-087** (`effecttsgo/crypto-random-uuid`): browser UI labels need a synchronous local identifier.
- **EH-088** (`effecttsgo/crypto-random-uuid`): default request IDs are generated synchronously before Effect execution.
- **EH-089** (`effecttsgo/crypto-random-uuid`): lock acquisition is a synchronous token-generation step around Bun file operations.
- **EH-090** (`effecttsgo/crypto-random-uuid`): staging paths are built synchronously in Bun's filesystem bridge.
- **EH-091** (`effecttsgo/crypto-random-uuid`): staging paths are computed before the Effect stream starts and must remain synchronous.
- **EH-092** (`effecttsgo/crypto-random-uuid`): the management client accepts a synchronous idempotency key.
- **EH-093** (`effecttsgo/extends-native-error`): This transport-only error is converted to a CmsError before entering an Effect failure channel.
- **EH-094** (`effecttsgo/global-console`): acceptance completion is intentionally emitted to CLI stdout.
- **EH-095** (`effecttsgo/global-console`): acceptance progress is intentionally emitted to CLI stdout.
- **EH-096** (`effecttsgo/global-console`): escape hatch maintenance CLI reports progress.
- **EH-097** (`effecttsgo/global-console`): escape hatch registry CLI reports to stdout and stderr.
- **EH-098** (`effecttsgo/global-console`): this script's contract is machine-readable CLI stdout.
- **EH-099** (`effecttsgo/global-fetch`): Browser mutation boundary is owned by the UI query client.
- **EH-100** (`effecttsgo/global-fetch`): CLI acceptance polling intentionally uses the platform fetch boundary.
- **EH-101** (`effecttsgo/global-fetch`): generated clients intentionally use the platform fetch boundary so callers can supply the browser or server runtime.
- **EH-102** (`effecttsgo/global-fetch`): integration test aborts an in-flight request against the live HTTP listener.
- **EH-103** (`effecttsgo/global-fetch`): integration test exercises an in-flight request during shutdown drain.
- **EH-104** (`effecttsgo/global-fetch`): integration test exercises JSON body limits through the live HTTP listener.
- **EH-105** (`effecttsgo/global-fetch`): integration test exercises multipart upload through the live HTTP listener.
- **EH-106** (`effecttsgo/global-fetch`): integration test exercises rejection during shutdown drain.
- **EH-107** (`effecttsgo/global-fetch`): integration test exercises request timeout through the live HTTP listener.
- **EH-108** (`effecttsgo/global-fetch`): integration test exercises the live HTTP listener through the platform fetch boundary.
- **EH-109** (`effecttsgo/global-fetch`): integration test starts a request that outlives the drain window.
- **EH-110** (`effecttsgo/global-fetch`): integration test streams an Asset download through the live HTTP listener.
- **EH-111** (`effecttsgo/global-fetch`): integration test uploads a paced multipart Asset body through the live HTTP listener.
- **EH-112** (`effecttsgo/global-fetch`): integration test uploads an Asset through the live HTTP listener.
- **EH-113** (`effecttsgo/global-fetch`): visual baseline setup queries the live Example CMS management API.
- **EH-114** (`effecttsgo/global-fetch`): visual baseline setup reads the live Example CMS management API.
- **EH-115** (`effecttsgo/global-fetch`): visual baseline setup writes through the live Example CMS management API.
- **EH-116** (`effecttsgo/global-fetch-in-effect`): generated clients intentionally use the platform fetch boundary so callers can supply the browser or server runtime.
- **EH-117** (`effecttsgo/global-timers`): slow handler delay mirrors a peer that keeps the connection open.
- **EH-118** (`effecttsgo/missing-pipeable-signature`): compileSnapshot is exported for typed internal call sites.
- **EH-119** (`effecttsgo/missing-pipeable-signature`): content list helper is intentionally a direct three-argument operation.
- **EH-120** (`effecttsgo/missing-pipeable-signature`): content list helper is intentionally a direct two-argument operation.
- **EH-121** (`effecttsgo/missing-pipeable-signature`): dual's generic overload is not inferred by the linter for this public helper.
- **EH-122** (`effecttsgo/missing-pipeable-signature`): editor transaction API is intentionally a direct two-argument operation.
- **EH-123** (`effecttsgo/missing-pipeable-signature`): escape hatch registry helpers are intentionally direct-call only.
- **EH-124** (`effecttsgo/missing-pipeable-signature`): interactive visual scenarios reset mutated Example CMS fixture entries.
- **EH-125** (`effecttsgo/missing-pipeable-signature`): JSON field helper is intentionally a direct two-argument operation.
- **EH-127** (`effecttsgo/missing-pipeable-signature`): multipart parsing is Promise-based and this helper is not a pipeable Effect API.
- **EH-128** (`effecttsgo/missing-pipeable-signature`): public serialize helper is not a pipeable Effect API.
- **EH-129** (`effecttsgo/missing-pipeable-signature`): Rich Text helpers are not pipeable Effect APIs.
- **EH-130** (`effecttsgo/missing-pipeable-signature`): route dispatch is a plain async helper, not a pipeable Effect API.
- **EH-131** (`effecttsgo/missing-pipeable-signature`): test helper is not a pipeable Effect API.
- **EH-132** (`effecttsgo/missing-pipeable-signature`): test JSON field helper is intentionally a direct two-argument operation.
- **EH-133** (`effecttsgo/missing-pipeable-signature`): test URL helper is intentionally a direct two-argument operation.
- **EH-134** (`effecttsgo/missing-pipeable-signature`): UI label helper is intentionally a direct two-argument operation.
- **EH-135** (`effecttsgo/missing-pipeable-signature`): UI value helper is intentionally a direct two-argument operation.
- **EH-136** (`effecttsgo/missing-pipeable-signature`): visual baseline setup queries the live Example CMS management API.
- **EH-137** (`effecttsgo/missing-pipeable-signature`): visual baseline setup reads the live Example CMS management API.
- **EH-138** (`effecttsgo/missing-pipeable-signature`): visual baseline setup writes through the live Example CMS management API.
- **EH-139** (`effecttsgo/missing-pipeable-signature`): Web handler timeout wrapper is not a pipeable Effect API.
- **EH-140** (`effecttsgo/missing-pipeable-signature`): Web Request.arrayBuffer is Promise-based and this helper is not a pipeable Effect API.
- **EH-141** (`effecttsgo/new-promise`): hanging handler keeps the socket open until forced shutdown.
- **EH-142** (`effecttsgo/new-promise`): slow handler simulates an in-flight socket request outside Effect.
- **EH-143** (`effecttsgo/node-builtin-import`): Accessibility test setup resolves axe-core from node_modules before any Effect application exists.
- **EH-144** (`effecttsgo/node-builtin-import`): Baseline paths are test-runner setup paths; there is no Effect runtime involved in this Bun test.
- **EH-145** (`effecttsgo/node-builtin-import`): Bun does not provide a path manipulation API; these operations are platform-neutral string handling.
- **EH-146** (`effecttsgo/node-builtin-import`): fileURLToPath converts Bun module resolution URLs into filesystem paths for axe-core serving.
- **EH-147** (`effecttsgo/node-builtin-import`): Journey setup creates an isolated filesystem root before the CMS layer starts.
- **EH-148** (`effecttsgo/node-builtin-import`): Path joining is host-path setup for this acceptance journey, outside the Effect service graph.
- **EH-149** (`effecttsgo/node-builtin-import`): Path joining is host-path setup for this filesystem integration test, outside the Effect service graph.
- **EH-150** (`effecttsgo/node-builtin-import`): Standalone CLI resolves repository paths before any Effect application exists.
- **EH-151** (`effecttsgo/node-builtin-import`): Temporary upload staging requires node fs primitives unavailable in the HTTP FileSystem abstraction.
- **EH-152** (`effecttsgo/node-builtin-import`): Temporary upload staging requires node os primitives unavailable in the HTTP FileSystem abstraction.
- **EH-153** (`effecttsgo/node-builtin-import`): Temporary upload staging requires node path primitives unavailable in the HTTP FileSystem abstraction.
- **EH-154** (`effecttsgo/node-builtin-import`): The test exercises the Bun filesystem adapter's on-disk behavior; these helpers have no Bun equivalent.
- **EH-155** (`effecttsgo/node-builtin-import`): This Bun adapter needs durable fsync/open and directory primitives unavailable in Effect's portable FileSystem layer.
- **EH-156** (`effecttsgo/prefer-schema-over-json`): request bodies are OpenAPI-generated unknown shapes and must be serialized using the browser JSON boundary.
- **EH-157** (`effecttsgo/run-effect-inside-effect`): bridge the abort callback into Promise.race.
- **EH-158** (`effecttsgo/run-effect-inside-effect`): interrupt the owned timer fiber during Web handler cleanup.
- **EH-159** (`effecttsgo/run-effect-inside-effect`): this Web handler owns a timer fiber outside the request Effect.
- **EH-160** (`effecttsgo/strict-effect-provide`): acceptance journey entry point needs a fresh isolated layer.
- **EH-161** (`effecttsgo/strict-effect-provide`): test entry point needs a fresh isolated layer per run.
- **EH-162** (`effecttsgo/strict-effect-provide`): test entry point needs a fresh isolated layer.
- **EH-163** (`eslint/func-style`): error status helpers are function declarations to keep CmsError Schema narrowing readable.
- **EH-164** (`eslint/init-declarations`): axe script server starts lazily when acceptance servers are ready.
- **EH-165** (`eslint/max-lines-per-function`): child spawn script must stay in one function for eval readability.
- **EH-166** (`eslint/max-lines-per-function`): escape hatch document rendering is intentionally colocated.
- **EH-167** (`eslint/max-lines-per-function`): escape hatch parsing and rendering are intentionally colocated.
- **EH-168** (`eslint/max-lines-per-function`): escape hatch registry CLI uses async filesystem IO.
- **EH-169** (`eslint/max-lines-per-function`): React panel helpers exceed function line budget after typed prop alias escape hatches.
- **EH-170** (`eslint/max-lines-per-function`): shutdown scenario keeps orchestration in one place for readability.
- **EH-171** (`eslint/max-params`): escape hatch parsing and rendering are intentionally colocated.
- **EH-172** (`eslint/max-statements`): escape hatch document rendering is intentionally colocated.
- **EH-173** (`eslint/max-statements`): escape hatch parsing and rendering are intentionally colocated.
- **EH-174** (`eslint/max-statements`): escape hatch registry CLI uses async filesystem IO.
- **EH-175** (`eslint/max-statements`): registry formatting keeps comment rendering colocated.
- **EH-176** (`eslint/max-statements`): registry rendering keeps family grouping colocated.
- **EH-177** (`eslint/no-await-in-loop`): file scans and updates must preserve source order.
- **EH-178** (`eslint/no-continue`): registry assignment skips unresolved rule and code pairs.
- **EH-179** (`eslint/no-ternary`): generated fetch bridge keeps compact signal fallback.
- **EH-180** (`eslint/no-ternary`): registry formatting keeps compact comment labels.
- **EH-181** (`eslint/no-ternary`): registry helpers keep related declarations grouped.
- **EH-182** (`eslint/one-var`): commit exit must follow the chmod yield before assertions.
- **EH-183** (`eslint/one-var`): commit exit must follow the manifest obstruction yield before assertions.
- **EH-184** (`eslint/one-var`): conflict setup reads entry state after the editor finishes loading.
- **EH-185** (`eslint/one-var`): CORS header mutation follows the origin allowlist guard.
- **EH-186** (`eslint/one-var`): exported bindings follow private fixture resolution in the same module.
- **EH-187** (`eslint/one-var`): helpers with readonly disables must stay as separate const declarations.
- **EH-188** (`eslint/one-var`): query response body and first item are parsed together after the status guard.
- **EH-189** (`eslint/one-var`): read-back must follow manifest obstruction cleanup before assertions.
- **EH-190** (`eslint/one-var`): read-back must follow the restore-chmod yield before assertions.
- **EH-191** (`eslint/one-var`): registry formatting keeps compact comment labels.
- **EH-192** (`eslint/one-var`): registry helpers keep related declarations grouped.
- **EH-193** (`eslint/one-var`): registry parsing uses ASCII comment markers only.
- **EH-194** (`eslint/one-var`): transport startup keeps separate statements so lint autofix does not merge dependency-ordered locals.
- **EH-195** (`eslint/require-unicode-regexp`): registry parsing uses ASCII comment markers only.
- **EH-196** (`no-await-in-loop`): checks intentionally run sequentially.
- **EH-197** (`no-await-in-loop`): cleanup must remain sequential.
- **EH-198** (`no-await-in-loop`): handlers must run sequentially until one matches.
- **EH-199** (`no-await-in-loop`): preserve ordered chunk writes.
- **EH-200** (`no-await-in-loop`): recursive cleanup must remain sequential.
- **EH-201** (`typescript/no-unnecessary-type-parameters`): React panel helpers preserve local prop aliases for component call sites.
- **EH-202** (`typescript/no-unsafe-type-assertion`): allowlist JSON is versioned repository fixture data validated at acceptance runtime.
- **EH-203** (`typescript/no-unsafe-type-assertion`): closest runs on the runtime Element resolved from the selection node.
- **EH-204** (`typescript/no-unsafe-type-assertion`): fetch requires AbortSignal; generated clients pass the runtime signal.
- **EH-205** (`typescript/no-unsafe-type-assertion`): list item filtering preserves list-item node shapes within the editor document.
- **EH-206** (`typescript/no-unsafe-type-assertion`): list replacement preserves list node shape after item removal.
- **EH-207** (`typescript/no-unsafe-type-assertion`): MutationObserver.observe requires Node; the editable host is a runtime HTMLElement.
- **EH-208** (`typescript/no-unsafe-type-assertion`): OpenAPI schema objects are validated as non-null objects before use.
- **EH-209** (`typescript/no-unsafe-type-assertion`): paragraph children inherit inline nodes from the lifted block root.
- **EH-210** (`typescript/no-unsafe-type-assertion`): ReadonlyEditableHost is a Pick view of the editable div passed at runtime.
- **EH-211** (`typescript/no-unsafe-type-assertion`): restoreSelectionRange reads selection anchors from the runtime editable host.
- **EH-212** (`typescript/no-unsafe-type-assertion`): RichText.toJson returns a JSON-compatible object validated by the CMS schema boundary.
- **EH-213** (`typescript/no-unsafe-type-assertion`): synchronizeSelectionState queries the runtime editable host for the current DOM selection.
- **EH-214** (`typescript/no-unsafe-type-assertion`): Web APIs require AbortSignal; transport callers always pass the real signal.
- **EH-215** (`typescript/no-unsafe-type-assertion`): Web APIs require Request; transport callers always pass the real request.
- **EH-216** (`typescript/prefer-readonly-parameter-types`): action log must remain mutable for assertions.
- **EH-217** (`typescript/prefer-readonly-parameter-types`): assignment states include mutable entry value maps.
- **EH-218** (`typescript/prefer-readonly-parameter-types`): batch mutations are built from mutable entry write tokens.
- **EH-219** (`typescript/prefer-readonly-parameter-types`): Bun.spawn requires a mutable string command argv.
- **EH-220** (`typescript/prefer-readonly-parameter-types`): byte buffers are passed to Bun.write without retaining references.
- **EH-221** (`typescript/prefer-readonly-parameter-types`): CmsError tagged unions are inspected via Schema.is without mutation.
- **EH-222** (`typescript/prefer-readonly-parameter-types`): comment submission bodies are validated as loosely typed JSON records.
- **EH-223** (`typescript/prefer-readonly-parameter-types`): conflict resolution callbacks receive mutable draft value maps.
- **EH-224** (`typescript/prefer-readonly-parameter-types`): create results use CMS mutation response union shapes.
- **EH-225** (`typescript/prefer-readonly-parameter-types`): deniedAction.current is mutated to simulate authorization denial.
- **EH-226** (`typescript/prefer-readonly-parameter-types`): discovery routes read configured operations without mutation.
- **EH-227** (`typescript/prefer-readonly-parameter-types`): document line buffer is mutated while rendering the registry.
- **EH-228** (`typescript/prefer-readonly-parameter-types`): DOM selection nodes are inspected without retaining references.
- **EH-229** (`typescript/prefer-readonly-parameter-types`): DOM spans are mutated while applying rich-text marks.
- **EH-230** (`typescript/prefer-readonly-parameter-types`): DOM spans are mutated while assigning editor selection indices.
- **EH-231** (`typescript/prefer-readonly-parameter-types`): DOM text spans are read while mapping native selection offsets.
- **EH-232** (`typescript/prefer-readonly-parameter-types`): drain polling reads shared active-request counters without mutating them.
- **EH-233** (`typescript/prefer-readonly-parameter-types`): editable hosts are mutated while restoring native selection ranges.
- **EH-234** (`typescript/prefer-readonly-parameter-types`): editable hosts are queried for live native selection state.
- **EH-235** (`typescript/prefer-readonly-parameter-types`): editable hosts are queried while synchronizing editor selection state.
- **EH-236** (`typescript/prefer-readonly-parameter-types`): Effect programs are executed by runOperationInterruptibly without mutation.
- **EH-237** (`typescript/prefer-readonly-parameter-types`): Effect programs are executed by runPromise without mutation.
- **EH-238** (`typescript/prefer-readonly-parameter-types`): Effect programs are executed, not mutated, by runPromise.
- **EH-239** (`typescript/prefer-readonly-parameter-types`): Effect programs are mapped without mutation.
- **EH-240** (`typescript/prefer-readonly-parameter-types`): handler Options includes requestIdentifier callbacks.
- **EH-241** (`typescript/prefer-readonly-parameter-types`): HttpTransport handler mirrors the Web Request callback contract.
- **EH-242** (`typescript/prefer-readonly-parameter-types`): ingest content may be a Uint8Array or Effect Stream consumed during commit.
- **EH-243** (`typescript/prefer-readonly-parameter-types`): Layer factory accepts optional builder configuration without mutation.
- **EH-244** (`typescript/prefer-readonly-parameter-types`): Layer values are provided to runPromise without mutation.
- **EH-245** (`typescript/prefer-readonly-parameter-types`): multipart errors are inspected via instanceof and Predicate.isTagged without mutation.
- **EH-246** (`typescript/prefer-readonly-parameter-types`): multipart errors are inspected via Predicate.isTagged without mutation.
- **EH-247** (`typescript/prefer-readonly-parameter-types`): multipart file parts expose mutable content streams for staging writes.
- **EH-248** (`typescript/prefer-readonly-parameter-types`): multipart state is mutated while parsing asset parts.
- **EH-249** (`typescript/prefer-readonly-parameter-types`): mutable assetIds out-param is bundled in input interface.
- **EH-250** (`typescript/prefer-readonly-parameter-types`): mutable issues and result out-params are bundled in input interface.
- **EH-251** (`typescript/prefer-readonly-parameter-types`): mutable issues out-param is bundled in input interface.
- **EH-252** (`typescript/prefer-readonly-parameter-types`): mutable listResult out-param is bundled in input interface.
- **EH-253** (`typescript/prefer-readonly-parameter-types`): mutable out-params are bundled in input interface.
- **EH-254** (`typescript/prefer-readonly-parameter-types`): mutable projected out-param is bundled in input interface.
- **EH-255** (`typescript/prefer-readonly-parameter-types`): mutable relationships out-param is bundled in input interface.
- **EH-256** (`typescript/prefer-readonly-parameter-types`): mutable values out-param is bundled in input interface.
- **EH-257** (`typescript/prefer-readonly-parameter-types`): mutation receipts use discriminated union shapes from CMS operations.
- **EH-258** (`typescript/prefer-readonly-parameter-types`): OpenAPI operation descriptors are read while building Effect HTTP API declarations.
- **EH-259** (`typescript/prefer-readonly-parameter-types`): OpenAPI operation descriptors are read while building path maps.
- **EH-260** (`typescript/prefer-readonly-parameter-types`): OpenAPI routes read configured operations without mutation.
- **EH-261** (`typescript/prefer-readonly-parameter-types`): OperationFetchRequest carries optional readonly abort signal bridge fields.
- **EH-264** (`typescript/prefer-readonly-parameter-types`): React callbacks receive mutable draft value maps from the editor.
- **EH-265** (`typescript/prefer-readonly-parameter-types`): React Query mutation and query objects expose mutable status while rendering history.
- **EH-266** (`typescript/prefer-readonly-parameter-types`): React Query results expose mutable status fields while rendering revision details.
- **EH-267** (`typescript/prefer-readonly-parameter-types`): RequestInit is passed directly into the Web Request constructor.
- **EH-268** (`typescript/prefer-readonly-parameter-types`): route handlers inspect operation metadata without mutating configured operations.
- **EH-269** (`typescript/prefer-readonly-parameter-types`): save results may return entry values directly or nested under entry.
- **EH-270** (`typescript/prefer-readonly-parameter-types`): shutdown mutates shared lifecycle counters and abort controllers.
- **EH-271** (`typescript/prefer-readonly-parameter-types`): spawn options include mutable environment maps.
- **EH-272** (`typescript/prefer-readonly-parameter-types`): staging writer state is mutated while finalizing blob writes.
- **EH-273** (`typescript/prefer-readonly-parameter-types`): stored asset bytes are read without mutation when serving range requests.
- **EH-274** (`typescript/prefer-readonly-parameter-types`): SynchronizedRef state is mutated while persisting ingested assets.
- **EH-275** (`typescript/prefer-readonly-parameter-types`): Uint8Array chunks are returned without mutation.
- **EH-276** (`typescript/prefer-readonly-parameter-types`): wrapped handlers mutate shared active-request counters.
- **EH-277** (`unicorn/no-array-sort`): registry keys are sorted in place before code assignment.
- **EH-278** (`unicorn/prefer-number-coercion`): registry code numbers are parsed from fixed-width labels.
- **EH-279** (`unicorn/prefer-ternary`): registry defaults keep explicit branch justifications.
- **EH-280** (`unicorn/prefer-ternary`): registry formatting keeps compact comment labels.
- **EH-281** (`effecttsgo/async-function`): escape hatch maintenance performs repository file scans.
- **EH-282** (`effecttsgo/async-function`): escape hatch maintenance updates source files sequentially to preserve formatting.
- **EH-283** (`eslint/no-await-in-loop`): escape hatch maintenance updates source files sequentially to preserve formatting.
- **EH-284** (`eslint/no-ternary`): reindex mode chooses between fresh sequential codes and preserved registry codes.
- **EH-286** (`effecttsgo/async-function`): escape hatch registry CLI keeps command dispatch in one entrypoint.
- **EH-287** (`eslint/max-statements`): escape hatch registry CLI keeps command dispatch in one entrypoint.
- **EH-288** (`eslint/no-await-in-loop`): escape hatch maintenance reads source files sequentially to preserve formatting.
- **EH-289** (`eslint/no-ternary`): reindex mode chooses between an empty code map and the persisted registry map.
- **EH-290** (`eslint/one-var`): reindex mode chooses between an empty code map and the persisted registry map.
- **EH-291** (`eslint/max-statements`): escape hatch maintenance updates source files sequentially to preserve formatting.
- **EH-293** (`effecttsgo/missing-pipeable-signature`): batch Definition Requirement derivation is intentionally a direct Snapshot lookup helper.
- **EH-294** (`effecttsgo/missing-pipeable-signature`): Definition Requirement derivation is intentionally a direct Snapshot lookup helper.
- **EH-295** (`effecttsgo/missing-pipeable-signature`): pagination parsing is intentionally a direct transport helper.
- **EH-296** (`effecttsgo/missing-pipeable-signature`): Public Content Export assembly is intentionally a pure snapshot helper.
- **EH-297** (`effecttsgo/missing-pipeable-signature`): Public Content Export route declaration is intentionally a direct HTTP contract helper.
- **EH-298** (`effecttsgo/missing-pipeable-signature`): public Entry page projection is intentionally a pure value transform helper.
- **EH-299** (`effecttsgo/missing-pipeable-signature`): public Entry projection is intentionally a pure value transform helper.
- **EH-300** (`effecttsgo/missing-pipeable-signature`): required path parameter lookup is intentionally a direct transport helper.
- **EH-301** (`effecttsgo/missing-pipeable-signature`): paginated Entry page reads are intentionally direct CMS service helpers.
- **EH-302** (`effecttsgo/missing-pipeable-signature`): slug Entry lookup is intentionally a direct CMS service helper.
- **EH-303** (`typescript/prefer-readonly-parameter-types`): Delivery Query builders accept Effect Schema classes that are not deeply readonly.
- **EH-304** (`typescript/prefer-readonly-parameter-types`): OperationSchema values include Effect Schema classes that are not deeply readonly.
- **EH-305** (`effecttsgo/missing-pipeable-signature`): Example CMS readSchemas is a thin DeliveryRecipes wrapper.
- **EH-306** (`effecttsgo/missing-pipeable-signature`): Example CMS requiredParameter is a thin DeliveryRecipes wrapper.
- **EH-307** (`eslint/one-var`): delivery operation assembly stays separate from schema constants.
- **EH-308** (`eslint/one-var`): digest and response headers are derived after the size guard.
- **EH-309** (`eslint/one-var`): digest helpers stay grouped in one local const block below exported defaults.
- **EH-310** (`eslint/one-var`): transport helpers stay in one local const block below exported pagination constants.
- **EH-311** (`typescript/no-unsafe-type-assertion`): Asset metadata is encoded as JSON without retaining class instances.
- **EH-312** (`typescript/no-unsafe-type-assertion`): Web Crypto digest failures are converted to defects via orDie at call sites.
- **EH-313** (`typescript/prefer-readonly-parameter-types`): SHA-256 digest accepts mutable byte buffers from TextEncoder output.

## Justification Registry

Grouped by linter family and rule. Entries within each rule are sorted by code.

### TypeScript · `@ts-expect-error`

#### EH-001: Arbitrary private subpaths are not public package exports.

**Locations:**

- `packages/nearly-headless-cms/test/types/public-api.ts:28`

### TypeScript · `typescript/no-unnecessary-type-parameters`

#### EH-201: React panel helpers preserve local prop aliases for component call sites.

**Locations:**

- `apps/example-cms/src/presentation/assets-page-dialogs-support.tsx:6`
- `apps/example-cms/src/presentation/assets-page-dialogs-support.tsx:15`
- `apps/example-cms/src/presentation/assets-page-dialogs-support.tsx:43`
- `apps/example-cms/src/presentation/assets-page-dialogs-support.tsx:52`
- `apps/example-cms/src/presentation/assets-page-dialogs-support.tsx:85`
- `apps/example-cms/src/presentation/assets-page-dialogs-support.tsx:112`
- `apps/example-cms/src/presentation/assets-page-dialogs-support.tsx:114`
- `apps/example-cms/src/presentation/assets-page-dialogs-support.tsx:116`
- `apps/example-cms/src/presentation/assets-page-header-support.tsx:6`
- `apps/example-cms/src/presentation/assets-page-header-support.tsx:8`
- `apps/example-cms/src/presentation/assets-page-header-support.tsx:10`
- `apps/example-cms/src/presentation/assets-page-header-support.tsx:16`
- `apps/example-cms/src/presentation/assets-page-header-support.tsx:59`
- `apps/example-cms/src/presentation/assets-page-header-support.tsx:61`
- `apps/example-cms/src/presentation/assets-page-header-support.tsx:63`
- `apps/example-cms/src/presentation/assets-page-header-support.tsx:69`
- `apps/example-cms/src/presentation/assets-page-header-support.tsx:106`
- `apps/example-cms/src/presentation/assets-page-header-support.tsx:115`
- `apps/example-cms/src/presentation/assets-page-header-support.tsx:121`
- `apps/example-cms/src/presentation/assets-page-panels-support.tsx:8`
- `apps/example-cms/src/presentation/assets-page-panels-support.tsx:10`
- `apps/example-cms/src/presentation/assets-page-panels-support.tsx:12`
- `apps/example-cms/src/presentation/assets-page-panels-support.tsx:18`
- `apps/example-cms/src/presentation/assets-page-panels-support.tsx:20`
- `apps/example-cms/src/presentation/assets-page-panels-support.tsx:53`
- `apps/example-cms/src/presentation/assets-page-panels-support.tsx:55`
- `apps/example-cms/src/presentation/assets-page-panels-support.tsx:57`
- `apps/example-cms/src/presentation/assets-page-panels-support.tsx:63`
- `apps/example-cms/src/presentation/assets-page-panels-support.tsx:65`
- `apps/example-cms/src/presentation/assets-page-panels-support.tsx:119`
- `apps/example-cms/src/presentation/assets-page-panels-support.tsx:121`
- `apps/example-cms/src/presentation/assets-page-panels-support.tsx:123`
- `apps/example-cms/src/presentation/assets-page-panels-support.tsx:129`
- `apps/example-cms/src/presentation/assets-page-panels-support.tsx:131`
- `apps/example-cms/src/presentation/entry-editor-controller-local-state-support.ts:14`
- `apps/example-cms/src/presentation/entry-editor-controller-local-state-support.ts:16`
- `apps/example-cms/src/presentation/entry-editor-controller-local-state-support.ts:63`
- `apps/example-cms/src/presentation/entry-editor-controller-view-actions-support.ts:4`
- `apps/example-cms/src/presentation/entry-editor-controller-view-actions-support.ts:6`
- `apps/example-cms/src/presentation/entry-editor-history-panel-body.tsx:89`
- `apps/example-cms/src/presentation/entry-editor-layout.tsx:42`
- `apps/example-cms/src/presentation/entry-editor-overlays.tsx:6`
- `apps/example-cms/src/presentation/entry-editor-publication-panel-fields-support.tsx:14`
- `apps/example-cms/src/presentation/entry-editor-publication-panel-fields-support.tsx:16`
- `apps/example-cms/src/presentation/entry-editor-publication-panel-fields-support.tsx:18`
- `apps/example-cms/src/presentation/entry-editor-publication-panel-fields-support.tsx:47`
- `apps/example-cms/src/presentation/entry-editor-publication-panel-fields-support.tsx:49`
- `apps/example-cms/src/presentation/entry-editor-publication-panel-fields-support.tsx:51`
- `apps/example-cms/src/presentation/entry-editor-publication-panel-fields-support.tsx:83`
- `apps/example-cms/src/presentation/entry-editor-publication-panel-fields-support.tsx:140`
- `apps/example-cms/src/presentation/entry-editor-publication-panel-fields-support.tsx:142`
- `apps/example-cms/src/presentation/entry-editor-publication-panel-fields-support.tsx:165`
- `apps/example-cms/src/presentation/entry-editor-publication-panel-fields-support.tsx:167`
- `apps/example-cms/src/presentation/entry-editor-publication-panel-fields-support.tsx:169`
- `apps/example-cms/src/presentation/entry-editor-publication-panel-fields-support.tsx:171`
- `apps/example-cms/src/presentation/entry-editor-publication-panel-fields-support.tsx:173`
- `apps/example-cms/src/presentation/entry-editor-publication-panel-fields-support.tsx:232`
- `apps/example-cms/src/presentation/entry-editor-publication-panel-fields-support.tsx:234`
- `apps/example-cms/src/presentation/entry-editor-publication-panel-fields-support.tsx:236`
- `apps/example-cms/src/presentation/entry-editor-publication-panel-sections-support.tsx:14`
- `apps/example-cms/src/presentation/entry-editor-publication-panel-sections-support.tsx:16`
- `apps/example-cms/src/presentation/entry-editor-publication-panel-sections-support.tsx:18`
- `apps/example-cms/src/presentation/entry-editor-publication-panel-sections-support.tsx:52`
- `apps/example-cms/src/presentation/entry-editor-publication-panel-sections-support.tsx:54`
- `apps/example-cms/src/presentation/entry-editor-publication-panel-sections-support.tsx:56`
- `apps/example-cms/src/presentation/entry-editor-publication-panel-sections-support.tsx:58`
- `apps/example-cms/src/presentation/entry-editor-publication-panel-sections-support.tsx:60`
- `apps/example-cms/src/presentation/entry-editor-publication-panel-sections-support.tsx:62`
- `apps/example-cms/src/presentation/entry-editor-publication-panel-sections-support.tsx:64`
- `apps/example-cms/src/presentation/entry-editor-publication-panel-support.tsx:9`
- `apps/example-cms/src/presentation/entry-editor-publication-panel-support.tsx:11`
- `apps/example-cms/src/presentation/entry-editor-publication-panel-support.tsx:13`
- `apps/example-cms/src/presentation/entry-editor-publication-panel-support.tsx:15`
- `apps/example-cms/src/presentation/entry-editor-publication-panel-support.tsx:17`
- `apps/example-cms/src/presentation/entry-editor-publication-panel-support.tsx:19`
- `apps/example-cms/src/presentation/entry-editor-publication-panel-support.tsx:21`
- `apps/example-cms/src/presentation/entry-editor-rich-text-field-support.ts:12`
- `apps/example-cms/src/presentation/entry-editor-rich-text-field-support.ts:14`
- `apps/example-cms/src/presentation/entry-editor-rich-text-field-support.ts:16`
- `apps/example-cms/src/presentation/entry-editor-rich-text-field-support.ts:18`
- `apps/example-cms/src/presentation/entry-editor-rich-text-field-support.ts:59`
- `apps/example-cms/src/presentation/entry-editor-rich-text-field-support.ts:61`
- `apps/example-cms/src/presentation/entry-editor-rich-text-field-view.tsx:24`
- `apps/example-cms/src/presentation/entry-editor-rich-text-insert-dialog-support.tsx:8`
- `apps/example-cms/src/presentation/entry-editor-rich-text-insert-dialog-support.tsx:10`
- `apps/example-cms/src/presentation/entry-editor-rich-text-insert-dialog.tsx:13`
- `apps/example-cms/src/presentation/entry-editor-rich-text-insert-dialog.tsx:15`
- `apps/example-cms/src/presentation/entry-editor-rich-text-toolbar-support.tsx:30`
- `apps/example-cms/src/presentation/entry-editor-rich-text-toolbar-support.tsx:32`
- `apps/example-cms/src/presentation/entry-editor-rich-text-toolbar-support.tsx:34`
- `apps/example-cms/src/presentation/entry-editor-rich-text-toolbar-support.tsx:104`
- `apps/example-cms/src/presentation/entry-editor-rich-text-toolbar.tsx:12`
- `apps/example-cms/src/presentation/entry-editor-rich-text-toolbar.tsx:14`
- `apps/example-cms/src/presentation/entry-editor-story-canvas-assets-support.tsx:6`
- `apps/example-cms/src/presentation/entry-editor-story-canvas-assets-support.tsx:8`
- `apps/example-cms/src/presentation/entry-editor-story-canvas-assets-support.tsx:10`
- `apps/example-cms/src/presentation/entry-editor-story-canvas-assets-support.tsx:33`
- `apps/example-cms/src/presentation/entry-editor-story-canvas-assets-support.tsx:35`
- `apps/example-cms/src/presentation/entry-editor-story-canvas-assets-support.tsx:37`
- `apps/example-cms/src/presentation/entry-editor-story-canvas-assets-support.tsx:65`
- `apps/example-cms/src/presentation/entry-editor-story-canvas-assets-support.tsx:67`
- `apps/example-cms/src/presentation/entry-editor-story-canvas-assets-support.tsx:88`
- `apps/example-cms/src/presentation/entry-editor-story-canvas-assets-support.tsx:90`
- `apps/example-cms/src/presentation/entry-editor-story-canvas-assets-support.tsx:92`
- `apps/example-cms/src/presentation/entry-editor-story-canvas-assets-support.tsx:126`
- `apps/example-cms/src/presentation/entry-editor-story-canvas-assets-support.tsx:128`
- `apps/example-cms/src/presentation/entry-editor-story-canvas-assets-support.tsx:130`
- `apps/example-cms/src/presentation/entry-editor-story-canvas-assets-support.tsx:171`
- `apps/example-cms/src/presentation/entry-editor-story-canvas-fields-support.tsx:24`
- `apps/example-cms/src/presentation/entry-editor-story-canvas-fields-support.tsx:26`
- `apps/example-cms/src/presentation/entry-editor-story-canvas-fields-support.tsx:63`
- `apps/example-cms/src/presentation/entry-editor-story-canvas-fields-support.tsx:65`
- `apps/example-cms/src/presentation/entry-editor-story-canvas-fields-support.tsx:114`
- `apps/example-cms/src/presentation/entry-editor-story-canvas-fields-support.tsx:116`
- `apps/example-cms/src/presentation/entry-editor-story-canvas-support.tsx:14`
- `apps/example-cms/src/presentation/entry-editor-story-canvas-support.tsx:16`
- `apps/example-cms/src/presentation/entry-editor-story-canvas-support.tsx:18`
- `apps/example-cms/src/presentation/entry-editor-story-canvas-support.tsx:35`
- `apps/example-cms/src/presentation/entry-editor-story-canvas-support.tsx:37`
- `apps/example-cms/src/presentation/entry-editor-story-canvas-support.tsx:39`
- `apps/example-cms/src/presentation/overview-panels-support.tsx:6`
- `apps/example-cms/src/presentation/rich-text-editor/transactions-editor-adapter-render.ts:68`
- `apps/example-cms/src/presentation/rich-text-editor/transactions-editor-adapter-render.ts:70`
- `apps/example-cms/src/presentation/rich-text-editor/transactions-editor-adapter-selection.ts:10`
- `apps/example-cms/src/presentation/rich-text-editor/transactions-list-command-handlers.ts:94`
- `apps/example-cms/src/presentation/rich-text-editor/transactions-list-command-handlers.ts:114`
- `apps/example-cms/src/presentation/rich-text-editor/transactions-list-command-handlers.ts:138`
- `apps/example-cms/src/presentation/rich-text-editor/transactions-list-command-handlers.ts:204`
- `apps/example-cms/src/presentation/rich-text-editor/transactions-mutations.ts:80`
- `apps/example-cms/src/presentation/rich-text-editor/transactions-mutations.ts:120`
- `apps/example-cms/src/presentation/rich-text-editor/transactions-selection.ts:8`
- `apps/example-cms/src/presentation/rich-text-editor/transactions-selection.ts:128`
- `apps/example-cms/src/presentation/rich-text-editor/transactions-support.ts:87`

### TypeScript · `typescript/no-unsafe-type-assertion`

#### EH-202: allowlist JSON is versioned repository fixture data validated at acceptance runtime.

**Locations:**

- `acceptance/accessibility/axe-webview-support.ts:29`

#### EH-203: closest runs on the runtime Element resolved from the selection node.

**Locations:**

- `apps/example-cms/src/presentation/rich-text-editor/transactions-editor-adapter-support.ts:149`

#### EH-204: fetch requires AbortSignal; generated clients pass the runtime signal.

**Locations:**

- `apps/example-cms/src/generated/headless-openapi-client-runtime-transport.ts:65`
- `apps/example-cms/src/generated/management-openapi-client-runtime-transport.ts:65`
- `apps/public-blog/src/core/generated/headless-openapi-client-runtime-transport.ts:65`
- `scripts/openapi-client-generator/runtime-template.ts:155`

#### EH-205: list item filtering preserves list-item node shapes within the editor document.

**Locations:**

- `apps/example-cms/src/presentation/rich-text-editor/transactions-list-command-handlers.ts:66`

#### EH-206: list replacement preserves list node shape after item removal.

**Locations:**

- `apps/example-cms/src/presentation/rich-text-editor/transactions-list-command-handlers.ts:62`

#### EH-207: MutationObserver.observe requires Node; the editable host is a runtime HTMLElement.

**Locations:**

- `apps/example-cms/src/presentation/rich-text-editor/browser-adapter.ts:96`

#### EH-208: OpenAPI schema objects are validated as non-null objects before use.

**Locations:**

- `scripts/openapi-client-generator/component-schema-names.ts:12`

#### EH-209: paragraph children inherit inline nodes from the lifted block root.

**Locations:**

- `apps/example-cms/src/presentation/rich-text-editor/transactions-list-command-handlers.ts:226`

#### EH-210: ReadonlyEditableHost is a Pick view of the editable div passed at runtime.

**Locations:**

- `apps/example-cms/src/presentation/rich-text-editor/transactions-editor-adapter-support.ts:86`

#### EH-211: restoreSelectionRange reads selection anchors from the runtime editable host.

**Locations:**

- `apps/example-cms/src/presentation/rich-text-editor/browser-adapter.ts:101`

#### EH-212: RichText.toJson returns a JSON-compatible object validated by the CMS schema boundary.

**Locations:**

- `apps/example-cms/src/core/content/seed-guides.ts:60`
- `apps/example-cms/src/core/content/seed.ts:26`

#### EH-213: synchronizeSelectionState queries the runtime editable host for the current DOM selection.

**Locations:**

- `apps/example-cms/src/presentation/rich-text-editor/browser-adapter.ts:126`

#### EH-214: Web APIs require AbortSignal; transport callers always pass the real signal.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-readonly-types.ts:23`

#### EH-215: Web APIs require Request; transport callers always pass the real request.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-readonly-types.ts:28`

#### EH-311: Asset metadata is encoded as JSON without retaining class instances.

**Locations:**

- `packages/nearly-headless-cms/src/http/delivery-recipes/public-export.ts:65`

#### EH-312: Web Crypto digest failures are converted to defects via orDie at call sites.

**Locations:**

- `packages/nearly-headless-cms/src/http/delivery-recipes/public-export.ts:47`

### TypeScript · `typescript/prefer-readonly-parameter-types`

#### EH-216: action log must remain mutable for assertions.

**Locations:**

- `packages/nearly-headless-cms/test/contract/authorization-expansion-support.ts:59`
- `packages/nearly-headless-cms/test/contract/authorization-expansion.test.ts:7`
- `packages/nearly-headless-cms/test/contract/authorization-expansion.test.ts:37`
- `packages/nearly-headless-cms/test/contract/authorization-expansion.test.ts:62`
- `packages/nearly-headless-cms/test/contract/authorization-expansion.test.ts:97`

#### EH-217: assignment states include mutable entry value maps.

**Locations:**

- `apps/example-cms/src/core/api/management/management-image-assignment-support.ts:27`
- `apps/example-cms/src/core/api/management/management-image-assignment-support.ts:29`

#### EH-218: batch mutations are built from mutable entry write tokens.

**Locations:**

- `apps/example-cms/src/core/api/management/management-cascade-deletions.ts:9`
- `apps/example-cms/src/core/api/management/management-cascade-deletions.ts:23`

#### EH-219: Bun.spawn requires a mutable string command argv.

**Locations:**

- `scripts/release.ts:19`

#### EH-220: byte buffers are passed to Bun.write without retaining references.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-support.ts:263`

#### EH-221: CmsError tagged unions are inspected via Schema.is without mutation.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-response.ts:42`
- `packages/nearly-headless-cms/src/http/http-transport-response.ts:58`
- `packages/nearly-headless-cms/src/http/http-transport-response.ts:69`
- `packages/nearly-headless-cms/src/http/http-transport-response.ts:80`
- `packages/nearly-headless-cms/src/http/http-transport-response.ts:94`
- `packages/nearly-headless-cms/src/http/http-transport-response.ts:105`
- `packages/nearly-headless-cms/src/http/http-transport-response.ts:116`
- `packages/nearly-headless-cms/src/http/http-transport-response.ts:127`
- `packages/nearly-headless-cms/src/http/http-transport-response.ts:146`

#### EH-222: comment submission bodies are validated as loosely typed JSON records.

**Locations:**

- `apps/example-cms/src/core/api/delivery/delivery-comment-submission-support.ts:173`

#### EH-223: conflict resolution callbacks receive mutable draft value maps.

**Locations:**

- `apps/example-cms/src/presentation/entry-editor-conflict-panel.tsx:16`
- `apps/example-cms/src/presentation/entry-editor-conflict-panel.tsx:67`

#### EH-224: create results use CMS mutation response union shapes.

**Locations:**

- `apps/example-cms/src/presentation/content-list-support.ts:56`

#### EH-225: deniedAction.current is mutated to simulate authorization denial.

**Locations:**

- `packages/nearly-headless-cms/test/contract/authorization-expansion.test.ts:9`

#### EH-226: discovery routes read configured operations without mutation.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-preflight-support.ts:68`

#### EH-227: document line buffer is mutated while rendering the registry.

**Locations:**

- `scripts/escape-hatches-render-support.ts:29`
- `scripts/escape-hatches-render-support.ts:75`

#### EH-228: DOM selection nodes are inspected without retaining references.

**Locations:**

- `apps/example-cms/src/presentation/rich-text-editor/transactions-editor-adapter-support.ts:128`
- `apps/example-cms/src/presentation/rich-text-editor/transactions-editor-adapter-support.ts:143`

#### EH-229: DOM spans are mutated while applying rich-text marks.

**Locations:**

- `apps/example-cms/src/presentation/rich-text-editor/transactions-editor-adapter-render.ts:16`

#### EH-230: DOM spans are mutated while assigning editor selection indices.

**Locations:**

- `apps/example-cms/src/presentation/rich-text-editor/transactions-editor-adapter-render.ts:30`

#### EH-231: DOM text spans are read while mapping native selection offsets.

**Locations:**

- `apps/example-cms/src/presentation/rich-text-editor/transactions-editor-adapter-support.ts:157`

#### EH-232: drain polling reads shared active-request counters without mutating them.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-lifecycle-support.ts:50`

#### EH-233: editable hosts are mutated while restoring native selection ranges.

**Locations:**

- `apps/example-cms/src/presentation/rich-text-editor/transactions-editor-adapter-selection.ts:51`

#### EH-234: editable hosts are queried for live native selection state.

**Locations:**

- `apps/example-cms/src/presentation/rich-text-editor/transactions-editor-adapter-selection.ts:42`

#### EH-235: editable hosts are queried while synchronizing editor selection state.

**Locations:**

- `apps/example-cms/src/presentation/rich-text-editor/transactions-editor-adapter-selection.ts:85`

#### EH-236: Effect programs are executed by runOperationInterruptibly without mutation.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-handler-support.ts:137`

#### EH-237: Effect programs are executed by runPromise without mutation.

**Locations:**

- `packages/nearly-headless-cms/test/contract/authorization-expansion-support.ts:57`
- `packages/nearly-headless-cms/test/filesystem/filesystem-commit-boundary-child-scenarios.ts:19`
- `packages/nearly-headless-cms/test/filesystem/filesystem-commit-boundary-scenarios.ts:17`
- `packages/nearly-headless-cms/test/filesystem/filesystem-concurrency-fault-scenarios.ts:37`
- `packages/nearly-headless-cms/test/filesystem/filesystem-fault-injection-manifest-scenarios.ts:44`
- `packages/nearly-headless-cms/test/filesystem/filesystem-fault-injection-scenarios.ts:23`
- `packages/nearly-headless-cms/test/filesystem/filesystem-fault-injection-scenarios.ts:31`
- `packages/nearly-headless-cms/test/filesystem/filesystem-path-invariant-scenarios.ts:29`
- `packages/nearly-headless-cms/test/filesystem/filesystem-path-invariant-scenarios.ts:39`
- `packages/nearly-headless-cms/test/filesystem/filesystem-persistence-corruption-scenarios.ts:29`
- `packages/nearly-headless-cms/test/filesystem/filesystem-persistence-scenarios.ts:203`
- `packages/nearly-headless-cms/test/filesystem/filesystem-persistence-writer-scenarios.ts:20`
- `packages/nearly-headless-cms/test/filesystem/filesystem-persistence-writer-scenarios.ts:30`
- `packages/nearly-headless-cms/test/integration/asset-http-delivery.test.ts:51`
- `packages/nearly-headless-cms/test/integration/asset-http-delivery.test.ts:59`
- `packages/nearly-headless-cms/test/integration/asset-http-delivery.test.ts:78`
- `packages/nearly-headless-cms/test/integration/asset-http-delivery.test.ts:104`
- `packages/nearly-headless-cms/test/integration/cms-service.test.ts:38`
- `packages/nearly-headless-cms/test/integration/definition-lifecycle.test.ts:16`
- `packages/nearly-headless-cms/test/integration/definition-lifecycle.test.ts:22`
- `packages/nearly-headless-cms/test/integration/definition-lifecycle.test.ts:28`
- `packages/nearly-headless-cms/test/integration/definition-migration-journey-scenarios.ts:67`
- `packages/nearly-headless-cms/test/integration/entry-history.test.ts:11`

#### EH-238: Effect programs are executed, not mutated, by runPromise.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-response.ts:220`

#### EH-239: Effect programs are mapped without mutation.

**Locations:**

- `apps/example-cms/src/generated/management-client.ts:258`

#### EH-240: handler Options includes requestIdentifier callbacks.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-handler.ts:135`

#### EH-241: HttpTransport handler mirrors the Web Request callback contract.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-lifecycle-support.ts:88`
- `packages/nearly-headless-cms/test/integration/asset-http-delivery.test.ts:46`

#### EH-242: ingest content may be a Uint8Array or Effect Stream consumed during commit.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-support.ts:74`
- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-support.ts:134`

#### EH-243: Layer factory accepts optional builder configuration without mutation.

**Locations:**

- `packages/nearly-headless-cms/src/bun/http/bun-http-transport.ts:15`

#### EH-244: Layer values are provided to runPromise without mutation.

**Locations:**

- `packages/nearly-headless-cms/test/filesystem/filesystem-commit-boundary-child-scenarios.ts:17`
- `packages/nearly-headless-cms/test/filesystem/filesystem-commit-boundary-scenarios.ts:15`
- `packages/nearly-headless-cms/test/filesystem/filesystem-concurrency-fault-scenarios.ts:35`
- `packages/nearly-headless-cms/test/filesystem/filesystem-fault-injection-manifest-scenarios.ts:42`
- `packages/nearly-headless-cms/test/filesystem/filesystem-fault-injection-scenarios.ts:21`
- `packages/nearly-headless-cms/test/filesystem/filesystem-fault-injection-scenarios.ts:29`
- `packages/nearly-headless-cms/test/filesystem/filesystem-path-invariant-scenarios.ts:27`
- `packages/nearly-headless-cms/test/filesystem/filesystem-path-invariant-scenarios.ts:37`
- `packages/nearly-headless-cms/test/filesystem/filesystem-persistence-corruption-scenarios.ts:27`
- `packages/nearly-headless-cms/test/filesystem/filesystem-persistence-scenarios.ts:201`
- `packages/nearly-headless-cms/test/filesystem/filesystem-persistence-writer-scenarios.ts:18`
- `packages/nearly-headless-cms/test/filesystem/filesystem-persistence-writer-scenarios.ts:28`
- `packages/nearly-headless-cms/test/integration/definition-migration-journey-scenarios.ts:65`

#### EH-245: multipart errors are inspected via instanceof and Predicate.isTagged without mutation.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-request-parsing-support.ts:142`

#### EH-246: multipart errors are inspected via Predicate.isTagged without mutation.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-request-parsing-support.ts:151`

#### EH-247: multipart file parts expose mutable content streams for staging writes.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-request-parsing-support.ts:176`

#### EH-248: multipart state is mutated while parsing asset parts.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-request-parsing-support.ts:120`

#### EH-249: mutable assetIds out-param is bundled in input interface.

**Locations:**

- `packages/nearly-headless-cms/src/cms-entry-references-support.ts:65`

#### EH-250: mutable issues and result out-params are bundled in input interface.

**Locations:**

- `packages/nearly-headless-cms/src/content-definition-entry-validation.ts:106`
- `packages/nearly-headless-cms/src/content-definition-entry-validation.ts:133`
- `packages/nearly-headless-cms/src/content-definition-entry-validation.ts:160`
- `packages/nearly-headless-cms/src/content-definition-entry-validation.ts:171`
- `packages/nearly-headless-cms/src/content-definition-entry-validation.ts:185`
- `packages/nearly-headless-cms/src/content-definition-entry-validation.ts:199`

#### EH-251: mutable issues out-param is bundled in input interface.

**Locations:**

- `packages/nearly-headless-cms/src/content-definition-entry-validation.ts:20`
- `packages/nearly-headless-cms/src/content-definition-entry-validation.ts:38`

#### EH-252: mutable listResult out-param is bundled in input interface.

**Locations:**

- `packages/nearly-headless-cms/src/content-definition-entry-validation.ts:73`
- `packages/nearly-headless-cms/src/content-definition-entry-validation.ts:98`

#### EH-253: mutable out-params are bundled in input interface.

**Locations:**

- `packages/nearly-headless-cms/src/cms-entry-references-support.ts:94`
- `packages/nearly-headless-cms/src/cms-entry-references-support.ts:106`
- `packages/nearly-headless-cms/src/cms-entry-references-support.ts:120`
- `packages/nearly-headless-cms/src/cms-entry-references-support.ts:133`

#### EH-254: mutable projected out-param is bundled in input interface.

**Locations:**

- `packages/nearly-headless-cms/src/entry-query-projection.ts:21`

#### EH-255: mutable relationships out-param is bundled in input interface.

**Locations:**

- `packages/nearly-headless-cms/src/cms-entry-references-support.ts:75`

#### EH-256: mutable values out-param is bundled in input interface.

**Locations:**

- `packages/nearly-headless-cms/src/cms-entry-expansion-field-group-support.ts:44`
- `packages/nearly-headless-cms/src/cms-entry-expansion-field-group-support.ts:78`
- `packages/nearly-headless-cms/src/cms-entry-expansion-relationship-support.ts:112`
- `packages/nearly-headless-cms/src/cms-entry-references-path-support.ts:36`

#### EH-257: mutation receipts use discriminated union shapes from CMS operations.

**Locations:**

- `apps/example-cms/src/core/api/delivery/delivery-comment-submission-support.ts:97`

#### EH-258: OpenAPI operation descriptors are read while building Effect HTTP API declarations.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-api.ts:120`
- `packages/nearly-headless-cms/src/http/http-api.ts:125`
- `packages/nearly-headless-cms/src/http/http-api.ts:129`
- `packages/nearly-headless-cms/src/http/http-api.ts:134`

#### EH-259: OpenAPI operation descriptors are read while building path maps.

**Locations:**

- `packages/nearly-headless-cms/src/http/open-api-management-paths.ts:90`
- `packages/nearly-headless-cms/src/http/open-api-management-paths.ts:100`
- `packages/nearly-headless-cms/src/http/open-api.ts:28`
- `packages/nearly-headless-cms/src/http/open-api.ts:48`
- `packages/nearly-headless-cms/src/http/open-api.ts:59`

#### EH-260: OpenAPI routes read configured operations without mutation.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-preflight-support.ts:94`
- `packages/nearly-headless-cms/src/http/http-transport-preflight-support.ts:96`

#### EH-261: OperationFetchRequest carries optional readonly abort signal bridge fields.

**Locations:**

- `apps/example-cms/src/generated/headless-openapi-client-runtime-transport.ts:46`
- `apps/example-cms/src/generated/management-openapi-client-runtime-transport.ts:46`
- `apps/public-blog/src/core/generated/headless-openapi-client-runtime-transport.ts:46`
- `scripts/openapi-client-generator/runtime-template.ts:139`

#### EH-264: React callbacks receive mutable draft value maps from the editor.

**Locations:**

- `apps/example-cms/src/presentation/entry-editor-controller-mutations.ts:24`
- `apps/example-cms/src/presentation/entry-editor-controller-mutations.ts:26`
- `apps/example-cms/src/presentation/entry-editor-mutations.ts:61`
- `apps/example-cms/src/presentation/entry-editor-mutations.ts:129`

#### EH-265: React Query mutation and query objects expose mutable status while rendering history.

**Locations:**

- `apps/example-cms/src/presentation/entry-editor-history-panel-body.tsx:48`

#### EH-266: React Query results expose mutable status fields while rendering revision details.

**Locations:**

- `apps/example-cms/src/presentation/entry-editor-revision-inspection.tsx:42`

#### EH-267: RequestInit is passed directly into the Web Request constructor.

**Locations:**

- `packages/nearly-headless-cms/test/integration/asset-http-delivery.test.ts:54`

#### EH-268: route handlers inspect operation metadata without mutating configured operations.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-delivery-routes.ts:18`
- `packages/nearly-headless-cms/src/http/http-transport-delivery-routes.ts:53`
- `packages/nearly-headless-cms/src/http/http-transport-handler.ts:52`
- `packages/nearly-headless-cms/src/http/http-transport-handler.ts:54`

#### EH-269: save results may return entry values directly or nested under entry.

**Locations:**

- `apps/example-cms/src/presentation/entry-editor-support.ts:22`

#### EH-270: shutdown mutates shared lifecycle counters and abort controllers.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-lifecycle-support.ts:65`

#### EH-271: spawn options include mutable environment maps.

**Locations:**

- `scripts/release.ts:21`

#### EH-272: staging writer state is mutated while finalizing blob writes.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-support.ts:158`

#### EH-273: stored asset bytes are read without mutation when serving range requests.

**Locations:**

- `apps/example-cms/src/core/api/delivery/delivery-public-asset-response-support.ts:109`

#### EH-274: SynchronizedRef state is mutated while persisting ingested assets.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-services.ts:218`

#### EH-275: Uint8Array chunks are returned without mutation.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-response.ts:163`

#### EH-276: wrapped handlers mutate shared active-request counters.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-lifecycle-support.ts:90`

#### EH-303: Delivery Query builders accept Effect Schema classes that are not deeply readonly.

**Locations:**

- `packages/nearly-headless-cms/src/http/delivery-recipes/delivery-query.ts:170`
- `packages/nearly-headless-cms/src/http/delivery-recipes/delivery-query.ts:195`
- `packages/nearly-headless-cms/src/http/delivery-recipes/public-export.ts:79`

#### EH-304: OperationSchema values include Effect Schema classes that are not deeply readonly.

**Locations:**

- `packages/nearly-headless-cms/src/http/delivery-recipes/delivery-query.ts:81`

#### EH-313: SHA-256 digest accepts mutable byte buffers from TextEncoder output.

**Locations:**

- `packages/nearly-headless-cms/src/http/delivery-recipes/public-export.ts:44`

### Effect · `effecttsgo/abort-controller-in-effect`

#### EH-002: transport shutdown keeps one shared AbortController for in-flight Web requests.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-lifecycle-support.ts:73`

### Effect · `effecttsgo/async-function`

#### EH-003: Asset staging finalization coordinates Bun writer flush and fsync boundaries.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-support.ts:161`

#### EH-004: Atomic persistence coordinates Bun and node filesystem promises.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-support.ts:260`

#### EH-005: axe acceptance scans compose awaited WebView navigation and evaluation.

**Locations:**

- `acceptance/accessibility/axe-webview.test.ts:38`
- `acceptance/accessibility/axe-webview.test.ts:76`
- `acceptance/accessibility/axe-webview.test.ts:115`

#### EH-006: baseline bytes are read through Promise-based Bun filesystem APIs.

**Locations:**

- `acceptance/visual/responsive-baselines.test.ts:121`

#### EH-007: Bun filesystem handles expose Promise-based synchronization boundaries.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-support.ts:176`

#### EH-008: Bun lifecycle hook performs async cleanup.

**Locations:**

- `acceptance/journeys/complete-system-journeys.test.ts:44`
- `apps/example-cms/test/integration/destructive-workflows.test.ts:27`
- `apps/example-cms/test/integration/headless-api.test.ts:30`
- `apps/example-cms/test/integration/public-visibility.test.ts:29`
- `apps/example-cms/test/integration/publication-validation.test.ts:29`

#### EH-009: Bun lifecycle hook performs async system setup.

**Locations:**

- `acceptance/journeys/complete-system-journeys.test.ts:34`
- `apps/example-cms/test/integration/destructive-workflows.test.ts:22`
- `apps/example-cms/test/integration/headless-api.test.ts:25`
- `apps/example-cms/test/integration/public-visibility.test.ts:24`
- `apps/example-cms/test/integration/publication-validation.test.ts:22`

#### EH-010: Bun WebView evaluation and sleep are Promise-based platform lifecycle operations.

**Locations:**

- `acceptance/visual/responsive-baselines.test.ts:147`
- `acceptance/webview/journey.test.ts:180`
- `acceptance/webview/journey.test.ts:199`
- `acceptance/webview/qualification.test.ts:44`

#### EH-011: Bun's test runner requires a Promise-returning lifecycle callback.

**Locations:**

- `acceptance/accessibility/axe-webview.test.ts:61`
- `acceptance/accessibility/axe-webview.test.ts:69`
- `acceptance/visual/responsive-baselines.test.ts:173`
- `acceptance/webview/journey.test.ts:223`
- `acceptance/webview/qualification.test.ts:66`

#### EH-012: cache invalidation must remain sequential.

**Locations:**

- `apps/example-cms/src/presentation/content-list-mutations.ts:32`

#### EH-013: Cleanup intentionally preserves sequential filesystem ordering.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-root.ts:100`

#### EH-014: CLI bootstrap reads package.json before any Effect program exists.

**Locations:**

- `packages/nearly-headless-cms/scripts/package-manifest.ts:5`
- `scripts/package-manifest.ts:5`

#### EH-015: CLI command runner awaits process completion.

**Locations:**

- `scripts/package-portability-smoke.ts:16`
- `scripts/run-acceptance.ts:23`

#### EH-016: CLI readiness polling requires awaited retries.

**Locations:**

- `scripts/run-acceptance.ts:40`

#### EH-017: conflict preparation follows controlled input setup despite alphabetical ordering.

**Locations:**

- `acceptance/visual/visual-baseline-scenarios.ts:174`

#### EH-018: controlled input updates precede conflict preparation despite alphabetical ordering.

**Locations:**

- `acceptance/visual/visual-baseline-scenarios.ts:154`

#### EH-019: definition routes delegate to catalog and migration handlers sequentially.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-definition-routes.ts:5`

#### EH-020: deletion sequence requires awaited server state.

**Locations:**

- `apps/example-cms/src/presentation/entry-editor-mutations.ts:23`

#### EH-021: Diagnostic inspection is a read-only filesystem boundary.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-root.ts:81`

#### EH-022: durable blob commits use Promise-based filesystem synchronization.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-support.ts:124`

#### EH-023: editor navigation depends on waitUntilExpression despite alphabetical ordering.

**Locations:**

- `acceptance/visual/visual-baseline-scenarios.ts:89`

#### EH-024: entry creation sequences dependent requests.

**Locations:**

- `apps/example-cms/src/presentation/content-list-mutations.ts:19`

#### EH-026: escape hatch registry CLI uses async filesystem IO.

**Locations:**

- `scripts/escape-hatches-parse-support.ts:49`
- `scripts/escape-hatches-parse-support.ts:165`
- `scripts/escape-hatches-registry-support.ts:11`
- `scripts/escape-hatches-registry-support.ts:69`
- `scripts/escape-hatches-registry-support.ts:166`
- `scripts/escape-hatches-support.ts:8`

#### EH-027: escape hatch registry helpers are intentionally direct-call only.

**Locations:**

- `scripts/escape-hatches-registry-support.ts:206`

#### EH-028: FileHandle.write is Promise-based and must remain ordered.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-request-parsing-support.ts:263`

#### EH-029: fingerprint validation awaits interruptible Effect execution.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-handler-support.ts:118`

#### EH-030: fixture setup intentionally awaits native filesystem and CMS startup.

**Locations:**

- `apps/example-cms/test/integration/destructive-workflows-fixture-scenarios.ts:11`
- `apps/example-cms/test/integration/headless-api-fixture-scenarios.ts:11`
- `apps/example-cms/test/integration/public-visibility-scenarios.ts:94`
- `apps/example-cms/test/integration/publication-validation-scenarios.ts:104`

#### EH-031: fixture teardown awaits native filesystem cleanup.

**Locations:**

- `apps/example-cms/test/integration/destructive-workflows-fixture-scenarios.ts:18`
- `apps/example-cms/test/integration/headless-api-fixture-scenarios.ts:17`
- `apps/example-cms/test/integration/public-visibility-scenarios.ts:102`
- `apps/example-cms/test/integration/publication-validation-scenarios.ts:111`

#### EH-032: generated clients expose a Promise-backed transport boundary; converting this callback to Effect would change the generated public client contract.

**Locations:**

- `apps/example-cms/src/generated/headless-openapi-client-runtime-transport.ts:99`
- `apps/example-cms/src/generated/headless-openapi-client-runtime-transport.ts:148`
- `apps/example-cms/src/generated/headless-openapi-client-runtime-transport.ts:186`
- `apps/example-cms/src/generated/management-openapi-client-runtime-transport.ts:129`
- `apps/example-cms/src/generated/management-openapi-client-runtime-transport.ts:178`
- `apps/example-cms/src/generated/management-openapi-client-runtime-transport.ts:216`
- `apps/public-blog/src/core/generated/headless-openapi-client-runtime-transport.ts:99`
- `apps/public-blog/src/core/generated/headless-openapi-client-runtime-transport.ts:148`
- `apps/public-blog/src/core/generated/headless-openapi-client-runtime-transport.ts:186`
- `scripts/openapi-client-generator/runtime-template.ts:2`
- `scripts/openapi-client-generator/runtime-template.ts:51`
- `scripts/openapi-client-generator/runtime-template.ts:86`

#### EH-033: Guard creation requires sequential Bun filesystem operations.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-io.ts:76`

#### EH-034: Handler is a Web-standard Promise<Response> callback.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-request-timeout-support.ts:98`

#### EH-035: helper intentionally awaits a native HTTP promise.

**Locations:**

- `packages/nearly-headless-cms/test/contract/http-contract-deletion-scenarios.ts:25`
- `packages/nearly-headless-cms/test/contract/http-contract-deletion-scenarios.ts:46`
- `packages/nearly-headless-cms/test/contract/http-contract-deletion-scenarios.ts:63`

#### EH-036: helper intentionally awaits native filesystem cleanup.

**Locations:**

- `apps/example-cms/test/integration/headless-api-restart-scenarios.ts:33`

#### EH-037: helper intentionally awaits native HTTP promises.

**Locations:**

- `apps/example-cms/test/integration/headless-api-delivery-scenarios.ts:27`
- `apps/example-cms/test/integration/headless-api-delivery-scenarios.ts:44`
- `apps/example-cms/test/integration/headless-api-management-scenarios.ts:34`
- `apps/example-cms/test/integration/headless-api-management-scenarios.ts:69`
- `apps/example-cms/test/integration/headless-api-management-scenarios.ts:82`
- `apps/example-cms/test/integration/headless-api-management-scenarios.ts:101`
- `apps/example-cms/test/integration/headless-api-management-scenarios.ts:131`
- `apps/example-cms/test/integration/headless-api-restart-scenarios.ts:21`

#### EH-038: HTTP contract assertions intentionally await native promises.

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
- `packages/nearly-headless-cms/test/contract/http-contract-multipart-scenarios.ts:79`
- `packages/nearly-headless-cms/test/contract/http-contract-multipart-scenarios.ts:91`
- `packages/nearly-headless-cms/test/contract/http-contract-multipart-scenarios.ts:99`
- `packages/nearly-headless-cms/test/contract/http-contract-multipart-scenarios.ts:109`
- `packages/nearly-headless-cms/test/contract/http-contract-multipart-scenarios.ts:125`
- `packages/nearly-headless-cms/test/contract/http-contract-multipart-scenarios.ts:137`
- `packages/nearly-headless-cms/test/contract/http-contract-multipart-scenarios.ts:160`
- `packages/nearly-headless-cms/test/contract/http-contract-multipart-scenarios.ts:179`
- `packages/nearly-headless-cms/test/contract/http-contract-multipart-scenarios.ts:190`
- `packages/nearly-headless-cms/test/contract/http-contract-transport-scenarios.ts:72`
- `packages/nearly-headless-cms/test/contract/http-contract-transport-scenarios.ts:84`
- `packages/nearly-headless-cms/test/contract/http-contract-transport-scenarios.ts:94`
- `packages/nearly-headless-cms/test/contract/http-contract-transport-scenarios.ts:102`
- `packages/nearly-headless-cms/test/contract/http-contract-transport-scenarios.ts:113`
- `packages/nearly-headless-cms/test/contract/http-contract-transport-scenarios.ts:129`
- `packages/nearly-headless-cms/test/contract/http-contract-transport-scenarios.ts:139`
- `packages/nearly-headless-cms/test/contract/http-contract-transport-scenarios.ts:151`

#### EH-039: interactive visual scenarios reset mutated Example CMS fixture entries.

**Locations:**

- `acceptance/visual/visual-baseline-management-support.ts:106`

#### EH-040: interruptible outcomes are awaited before routing continues.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-handler-support.ts:135`

#### EH-041: journey assertions compose awaited WebView navigation and evaluation.

**Locations:**

- `acceptance/webview/journey.test.ts:23`
- `acceptance/webview/journey.test.ts:33`
- `acceptance/webview/journey.test.ts:38`
- `acceptance/webview/journey.test.ts:68`
- `acceptance/webview/journey.test.ts:93`

#### EH-042: journey orchestration composes native WebView Promise operations.

**Locations:**

- `acceptance/webview/journey.test.ts:127`
- `acceptance/webview/journey.test.ts:139`
- `acceptance/webview/journey.test.ts:160`

#### EH-043: journey orchestration follows helper dependency order despite alphabetical ordering.

**Locations:**

- `acceptance/webview/journey.test.ts:150`

#### EH-044: JSON loading uses Bun's asynchronous file API.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-root-load-support.ts:58`

#### EH-045: lifecycle wrapper is a Web-standard Promise<Response> callback.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-lifecycle-support.ts:93`

#### EH-046: Lock cleanup reads and removes a Bun filesystem record.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-io.ts:218`

#### EH-047: Lock creation requires sequential Bun filesystem operations.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-io.ts:88`

#### EH-048: Lock records are read through Bun's filesystem Promise API.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-io.ts:173`

#### EH-049: multipart parsing is Promise-based and this helper is not a pipeable Effect API.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-request-parsing-support.ts:209`

#### EH-050: parallel architecture scans use async file reads.

**Locations:**

- `scripts/check-architecture.ts:216`

#### EH-051: parallel portability scans use async file reads.

**Locations:**

- `scripts/check-architecture.ts:233`

#### EH-052: Persistence spans ordered atomic filesystem writes.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-io.ts:136`

#### EH-053: qualification assertions compose awaited WebView navigation and evaluation.

**Locations:**

- `acceptance/webview/qualification.test.ts:10`

#### EH-054: React query callback awaits cache invalidation.

**Locations:**

- `apps/example-cms/src/presentation/assets-page-mutations-support.ts:29`
- `apps/example-cms/src/presentation/assets-page-mutations-support.ts:39`
- `apps/example-cms/src/presentation/entry-editor-history-panel-body.tsx:177`

#### EH-055: React query callback awaits navigation.

**Locations:**

- `apps/example-cms/src/presentation/entry-editor-mutations.ts:109`

#### EH-056: React query callback sequences invalidation before navigation.

**Locations:**

- `apps/example-cms/src/presentation/content-list-mutations.ts:31`

#### EH-057: React query error callback awaits the latest server state.

**Locations:**

- `apps/example-cms/src/presentation/entry-editor-mutations.ts:148`

#### EH-058: React query mutation is an intentional browser async boundary.

**Locations:**

- `apps/example-cms/src/presentation/overview-rebuild-support.ts:5`

#### EH-059: React query mutation must bridge browser fetch.

**Locations:**

- `apps/example-cms/src/presentation/content-list-mutations.ts:18`

#### EH-060: Recovery locking is a filesystem callback boundary.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-io.ts:24`

#### EH-061: recursive acceptance retries compose native WebView Promise operations.

**Locations:**

- `acceptance/webview/qualification.test.ts:68`

#### EH-062: recursive polling requires awaited retries.

**Locations:**

- `scripts/run-acceptance.ts:45`

#### EH-063: request handling awaits body parsing and Effect execution.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-handler.ts:142`

#### EH-064: request handling awaits route dispatch before returning a final response.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-handler.ts:103`

#### EH-065: Returned release callback closes the Bun filesystem guard.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-io.ts:38`

#### EH-066: Root initialization coordinates ordered filesystem operations.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-root-load-generation-support.ts:59`
- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-root-load-generation-support.ts:73`
- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-root-load-generation-support.ts:81`
- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-root-load-support.ts:29`
- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-root.ts:44`
- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-root.ts:65`

#### EH-067: route dispatch is a plain async helper, not a pipeable Effect API.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-route-dispatch.ts:7`

#### EH-068: route handlers await JSON body parsing before Effect execution.

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

#### EH-069: scenario intentionally awaits native HTTP promises.

**Locations:**

- `apps/example-cms/test/integration/destructive-workflows-asset-scenarios.ts:86`
- `apps/example-cms/test/integration/destructive-workflows-author-scenarios.ts:61`

#### EH-070: screenshot and filesystem APIs are Promise-based Bun platform operations.

**Locations:**

- `acceptance/visual/responsive-baselines.test.ts:99`

#### EH-071: slow consumer reads intentionally await Bun.sleep between stream chunks; readNextChunk closes over reader.

**Locations:**

- `packages/nearly-headless-cms/test/integration/http-socket-integration-backpressure-scenarios.ts:54`

#### EH-072: snapshot resolution awaits interruptible Effect execution before routing.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-handler-support.ts:158`

#### EH-073: socket acceptance polling coordinates shutdown timing outside Effect.

**Locations:**

- `packages/nearly-headless-cms/test/integration/http-socket-integration-shutdown-scenarios.ts:34`

#### EH-074: Stale guard recovery reads and reclaims a Bun filesystem record.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-io.ts:181`

#### EH-075: Stale lock recovery coordinates sequential Bun filesystem operations.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-io.ts:59`
- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-io.ts:195`

#### EH-076: the public Web handler contract returns a Promise<Response>.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-response.ts:206`

#### EH-077: validation screenshot normalization runs after React settles in the test finalize hook.

**Locations:**

- `acceptance/visual/visual-baseline-scenarios.ts:218`

#### EH-078: visual baseline polling composes sequential WebView evaluation and sleep.

**Locations:**

- `acceptance/visual/visual-baseline-scenarios.ts:49`

#### EH-079: visual baseline preparation composes awaited WebView navigation and evaluation.

**Locations:**

- `acceptance/visual/visual-baseline-scenarios.ts:101`
- `acceptance/visual/visual-baseline-scenarios.ts:145`
- `acceptance/visual/visual-baseline-scenarios.ts:198`
- `acceptance/visual/visual-baseline-scenarios.ts:223`
- `acceptance/visual/visual-baseline-scenarios.ts:227`
- `acceptance/visual/visual-baseline-scenarios.ts:231`
- `acceptance/visual/visual-baseline-scenarios.ts:236`
- `acceptance/visual/visual-baseline-scenarios.ts:241`
- `acceptance/visual/visual-baseline-scenarios.ts:245`

#### EH-080: visual baseline setup prepares invalid draft publication state through the management API.

**Locations:**

- `acceptance/visual/visual-baseline-scenarios.ts:17`

#### EH-081: visual baseline setup queries the live Example CMS management API.

**Locations:**

- `acceptance/visual/visual-baseline-management-support.ts:18`

#### EH-082: visual baseline setup reads the live Example CMS management API.

**Locations:**

- `acceptance/visual/visual-baseline-management-support.ts:43`

#### EH-083: visual baseline setup writes through the live Example CMS management API.

**Locations:**

- `acceptance/visual/visual-baseline-management-support.ts:83`

#### EH-084: Web Request.arrayBuffer is Promise-based and this helper is not a pipeable Effect API.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-request-parsing.ts:96`

#### EH-085: WebView readiness polling composes awaited evaluation and sleep.

**Locations:**

- `acceptance/accessibility/axe-webview.test.ts:138`

#### EH-086: Writer lock creation is a sequential Bun filesystem boundary.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-io.ts:46`
- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-io.ts:225`

#### EH-281: escape hatch maintenance performs repository file scans.

**Locations:**

- `scripts/escape-hatches-strip-support.ts:52`

#### EH-282: escape hatch maintenance updates source files sequentially to preserve formatting.

**Locations:**

- `scripts/escape-hatches-strip-support.ts:65`

#### EH-286: escape hatch registry CLI keeps command dispatch in one entrypoint.

**Locations:**

- `scripts/escape-hatches-support.ts:36`

### Effect · `effecttsgo/crypto-random-uuid`

#### EH-087: browser UI labels need a synchronous local identifier.

**Locations:**

- `apps/example-cms/src/presentation/content-list-support.ts:12`

#### EH-088: default request IDs are generated synchronously before Effect execution.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-handler-support.ts:203`

#### EH-089: lock acquisition is a synchronous token-generation step around Bun file operations.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-io.ts:27`
- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-io.ts:51`

#### EH-090: staging paths are built synchronously in Bun's filesystem bridge.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-support.ts:268`

#### EH-091: staging paths are computed before the Effect stream starts and must remain synchronous.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-support.ts:83`

#### EH-092: the management client accepts a synchronous idempotency key.

**Locations:**

- `apps/example-cms/src/presentation/assets-page-mutations-support.ts:12`
- `apps/example-cms/src/presentation/assets-page-mutations-support.ts:26`

### Effect · `effecttsgo/extends-native-error`

#### EH-093: This transport-only error is converted to a CmsError before entering an Effect failure channel.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-request-failure.ts:1`

### Effect · `effecttsgo/global-console`

#### EH-094: acceptance completion is intentionally emitted to CLI stdout.

**Locations:**

- `scripts/run-acceptance.ts:114`

#### EH-095: acceptance progress is intentionally emitted to CLI stdout.

**Locations:**

- `scripts/run-acceptance.ts:28`

#### EH-096: escape hatch maintenance CLI reports progress.

**Locations:**

- `scripts/escape-hatches-strip-support.ts:80`

#### EH-097: escape hatch registry CLI reports to stdout and stderr.

**Locations:**

- `scripts/escape-hatches-support.ts:14`
- `scripts/escape-hatches-support.ts:22`
- `scripts/escape-hatches-support.ts:30`
- `scripts/escape-hatches-support.ts:52`
- `scripts/escape-hatches-support.ts:63`

#### EH-098: this script's contract is machine-readable CLI stdout.

**Locations:**

- `scripts/check-architecture.ts:263`

### Effect · `effecttsgo/global-fetch`

#### EH-099: Browser mutation boundary is owned by the UI query client.

**Locations:**

- `apps/example-cms/src/presentation/overview-rebuild-support.ts:7`

#### EH-100: CLI acceptance polling intentionally uses the platform fetch boundary.

**Locations:**

- `scripts/run-acceptance.ts:51`

#### EH-101: generated clients intentionally use the platform fetch boundary so callers can supply the browser or server runtime.

**Locations:**

- `apps/example-cms/src/generated/headless-openapi-client-runtime-transport.ts:49`
- `apps/example-cms/src/generated/management-openapi-client-runtime-transport.ts:49`
- `apps/public-blog/src/core/generated/headless-openapi-client-runtime-transport.ts:49`
- `scripts/openapi-client-generator/runtime-template.ts:142`

#### EH-102: integration test aborts an in-flight request against the live HTTP listener.

**Locations:**

- `packages/nearly-headless-cms/test/integration/http-socket-integration-disconnect-scenarios.ts:39`

#### EH-103: integration test exercises an in-flight request during shutdown drain.

**Locations:**

- `packages/nearly-headless-cms/test/integration/http-socket-integration-shutdown-scenarios.ts:30`

#### EH-104: integration test exercises JSON body limits through the live HTTP listener.

**Locations:**

- `packages/nearly-headless-cms/test/integration/http-socket-integration-body-limit-scenarios.ts:41`

#### EH-105: integration test exercises multipart upload through the live HTTP listener.

**Locations:**

- `packages/nearly-headless-cms/test/integration/http-socket-integration-multipart-scenarios.ts:54`

#### EH-106: integration test exercises rejection during shutdown drain.

**Locations:**

- `packages/nearly-headless-cms/test/integration/http-socket-integration-shutdown-scenarios.ts:55`

#### EH-107: integration test exercises request timeout through the live HTTP listener.

**Locations:**

- `packages/nearly-headless-cms/test/integration/http-socket-integration-timeout-scenarios.ts:36`

#### EH-108: integration test exercises the live HTTP listener through the platform fetch boundary.

**Locations:**

- `packages/nearly-headless-cms/test/integration/http-socket-integration-scenarios.ts:32`

#### EH-109: integration test starts a request that outlives the drain window.

**Locations:**

- `packages/nearly-headless-cms/test/integration/http-socket-integration-forced-shutdown-scenarios.ts:19`

#### EH-110: integration test streams an Asset download through the live HTTP listener.

**Locations:**

- `packages/nearly-headless-cms/test/integration/http-socket-integration-backpressure-scenarios.ts:88`

#### EH-111: integration test uploads a paced multipart Asset body through the live HTTP listener.

**Locations:**

- `packages/nearly-headless-cms/test/integration/http-socket-integration-slow-producer-scenarios.ts:66`

#### EH-112: integration test uploads an Asset through the live HTTP listener.

**Locations:**

- `packages/nearly-headless-cms/test/integration/http-socket-integration-backpressure-scenarios.ts:73`

#### EH-113: visual baseline setup queries the live Example CMS management API.

**Locations:**

- `acceptance/visual/visual-baseline-management-support.ts:23`

#### EH-114: visual baseline setup reads the live Example CMS management API.

**Locations:**

- `acceptance/visual/visual-baseline-management-support.ts:48`

#### EH-115: visual baseline setup writes through the live Example CMS management API.

**Locations:**

- `acceptance/visual/visual-baseline-management-support.ts:90`

### Effect · `effecttsgo/global-fetch-in-effect`

#### EH-116: generated clients intentionally use the platform fetch boundary so callers can supply the browser or server runtime.

**Locations:**

- `apps/example-cms/src/generated/headless-openapi-client-runtime-transport.ts:49`
- `apps/example-cms/src/generated/management-openapi-client-runtime-transport.ts:49`
- `apps/public-blog/src/core/generated/headless-openapi-client-runtime-transport.ts:49`
- `scripts/openapi-client-generator/runtime-template.ts:142`

### Effect · `effecttsgo/global-timers`

#### EH-117: slow handler delay mirrors a peer that keeps the connection open.

**Locations:**

- `packages/nearly-headless-cms/test/integration/http-socket-integration-shutdown-scenarios.ts:18`

### Effect · `effecttsgo/missing-pipeable-signature`

#### EH-118: compileSnapshot is exported for typed internal call sites.

**Locations:**

- `packages/nearly-headless-cms/src/content-definition-compile.ts:94`

#### EH-119: content list helper is intentionally a direct three-argument operation.

**Locations:**

- `apps/example-cms/src/presentation/content-list-support.ts:14`
- `apps/example-cms/src/presentation/content-list-support.ts:73`

#### EH-120: content list helper is intentionally a direct two-argument operation.

**Locations:**

- `apps/example-cms/src/presentation/content-list-support.ts:119`

#### EH-121: dual's generic overload is not inferred by the linter for this public helper.

**Locations:**

- `packages/nearly-headless-cms/src/content-definition-compatibility.ts:10`
- `packages/nearly-headless-cms/src/content-definition-compile.ts:124`
- `packages/nearly-headless-cms/src/definition-migration.ts:26`
- `packages/nearly-headless-cms/src/definition-migration.ts:62`
- `packages/nearly-headless-cms/src/rich-text.ts:62`
- `packages/nearly-headless-cms/src/rich-text.ts:70`
- `packages/nearly-headless-cms/src/rich-text.ts:75`

#### EH-122: editor transaction API is intentionally a direct two-argument operation.

**Locations:**

- `apps/example-cms/src/presentation/rich-text-editor/transactions-dispatch.ts:63`

#### EH-123: escape hatch registry helpers are intentionally direct-call only.

**Locations:**

- `scripts/escape-hatches-registry-support.ts:206`

#### EH-124: interactive visual scenarios reset mutated Example CMS fixture entries.

**Locations:**

- `acceptance/visual/visual-baseline-management-support.ts:106`

#### EH-125: JSON field helper is intentionally a direct two-argument operation.

**Locations:**

- `apps/example-cms/test/integration/headless-api-support.ts:36`

#### EH-127: multipart parsing is Promise-based and this helper is not a pipeable Effect API.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-request-parsing-support.ts:209`
- `packages/nearly-headless-cms/src/http/http-transport-request-parsing.ts:167`

#### EH-128: public serialize helper is not a pipeable Effect API.

**Locations:**

- `packages/nearly-headless-cms/src/rich-text.ts:68`

#### EH-129: Rich Text helpers are not pipeable Effect APIs.

**Locations:**

- `packages/nearly-headless-cms/src/rich-text.ts:57`

#### EH-130: route dispatch is a plain async helper, not a pipeable Effect API.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-route-dispatch.ts:7`

#### EH-131: test helper is not a pipeable Effect API.

**Locations:**

- `packages/nearly-headless-cms/test/contract/authorization-expansion-support.ts:55`

#### EH-132: test JSON field helper is intentionally a direct two-argument operation.

**Locations:**

- `apps/example-cms/test/integration/public-visibility-support.ts:27`
- `apps/example-cms/test/integration/public-visibility-support.ts:38`

#### EH-133: test URL helper is intentionally a direct two-argument operation.

**Locations:**

- `apps/example-cms/test/integration/headless-api-support.ts:23`
- `apps/example-cms/test/integration/publication-validation-support.ts:27`
- `apps/example-cms/test/integration/publication-validation-support.ts:30`

#### EH-134: UI label helper is intentionally a direct two-argument operation.

**Locations:**

- `apps/example-cms/src/presentation/main-labels.ts:15`
- `apps/example-cms/src/presentation/main-labels.ts:88`
- `apps/example-cms/src/presentation/main-labels.ts:182`

#### EH-135: UI value helper is intentionally a direct two-argument operation.

**Locations:**

- `apps/example-cms/src/presentation/main-entry-support.ts:89`

#### EH-136: visual baseline setup queries the live Example CMS management API.

**Locations:**

- `acceptance/visual/visual-baseline-management-support.ts:18`

#### EH-137: visual baseline setup reads the live Example CMS management API.

**Locations:**

- `acceptance/visual/visual-baseline-management-support.ts:43`

#### EH-138: visual baseline setup writes through the live Example CMS management API.

**Locations:**

- `acceptance/visual/visual-baseline-management-support.ts:83`

#### EH-139: Web handler timeout wrapper is not a pipeable Effect API.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-request-timeout-support.ts:87`

#### EH-140: Web Request.arrayBuffer is Promise-based and this helper is not a pipeable Effect API.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-request-parsing.ts:96`

#### EH-293: batch Definition Requirement derivation is intentionally a direct Snapshot lookup helper.

**Locations:**

- `packages/nearly-headless-cms/src/http/delivery-recipes/definition-requirement.ts:80`

#### EH-294: Definition Requirement derivation is intentionally a direct Snapshot lookup helper.

**Locations:**

- `packages/nearly-headless-cms/src/http/delivery-recipes/definition-requirement.ts:65`

#### EH-295: pagination parsing is intentionally a direct transport helper.

**Locations:**

- `packages/nearly-headless-cms/src/http/delivery-recipes/pagination.ts:21`

#### EH-296: Public Content Export assembly is intentionally a pure snapshot helper.

**Locations:**

- `packages/nearly-headless-cms/src/http/delivery-recipes/public-export.ts:56`

#### EH-297: Public Content Export route declaration is intentionally a direct HTTP contract helper.

**Locations:**

- `packages/nearly-headless-cms/src/http/delivery-recipes/public-export.ts:77`

#### EH-298: public Entry page projection is intentionally a pure value transform helper.

**Locations:**

- `packages/nearly-headless-cms/src/http/delivery-recipes/public-entry-value.ts:32`

#### EH-299: public Entry projection is intentionally a pure value transform helper.

**Locations:**

- `packages/nearly-headless-cms/src/http/delivery-recipes/public-entry-value.ts:10`

#### EH-300: required path parameter lookup is intentionally a direct transport helper.

**Locations:**

- `packages/nearly-headless-cms/src/http/delivery-recipes/pagination.ts:29`

#### EH-301: paginated Entry page reads are intentionally direct CMS service helpers.

**Locations:**

- `packages/nearly-headless-cms/src/http/delivery-recipes/delivery-query.ts:124`

#### EH-302: slug Entry lookup is intentionally a direct CMS service helper.

**Locations:**

- `packages/nearly-headless-cms/src/http/delivery-recipes/delivery-query.ts:141`

#### EH-305: Example CMS readSchemas is a thin DeliveryRecipes wrapper.

**Locations:**

- `apps/example-cms/src/core/api/delivery/delivery-support.ts:81`

#### EH-306: Example CMS requiredParameter is a thin DeliveryRecipes wrapper.

**Locations:**

- `apps/example-cms/src/core/api/delivery/delivery-support.ts:95`

### Effect · `effecttsgo/new-promise`

#### EH-141: hanging handler keeps the socket open until forced shutdown.

**Locations:**

- `packages/nearly-headless-cms/test/integration/http-socket-integration-forced-shutdown-scenarios.ts:12`

#### EH-142: slow handler simulates an in-flight socket request outside Effect.

**Locations:**

- `packages/nearly-headless-cms/test/integration/http-socket-integration-shutdown-scenarios.ts:16`

### Effect · `effecttsgo/node-builtin-import`

#### EH-143: Accessibility test setup resolves axe-core from node_modules before any Effect application exists.

**Locations:**

- `acceptance/accessibility/axe-webview-support.ts:3`

#### EH-144: Baseline paths are test-runner setup paths; there is no Effect runtime involved in this Bun test.

**Locations:**

- `acceptance/visual/responsive-baselines.test.ts:3`

#### EH-145: Bun does not provide a path manipulation API; these operations are platform-neutral string handling.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-io.ts:19`
- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-root-imports.ts:14`
- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-root-load-imports.ts:4`
- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-services-imports.ts:29`
- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-support-imports.ts:17`

#### EH-146: fileURLToPath converts Bun module resolution URLs into filesystem paths for axe-core serving.

**Locations:**

- `acceptance/accessibility/axe-webview-support.ts:1`

#### EH-147: Journey setup creates an isolated filesystem root before the CMS layer starts.

**Locations:**

- `acceptance/journeys/complete-system-journeys-scenarios-imports.ts:12`
- `packages/nearly-headless-cms/test/integration/definition-migration-journey-scenarios-imports.ts:17`

#### EH-148: Path joining is host-path setup for this acceptance journey, outside the Effect service graph.

**Locations:**

- `acceptance/journeys/complete-system-journeys-scenarios-imports.ts:14`
- `packages/nearly-headless-cms/test/integration/definition-migration-journey-scenarios-imports.ts:19`

#### EH-149: Path joining is host-path setup for this filesystem integration test, outside the Effect service graph.

**Locations:**

- `packages/nearly-headless-cms/test/filesystem/filesystem-commit-boundary-child-scenarios-imports.ts:11`
- `packages/nearly-headless-cms/test/filesystem/filesystem-commit-boundary-child-spawn.ts:1`
- `packages/nearly-headless-cms/test/filesystem/filesystem-commit-boundary-child-spawn.ts:3`
- `packages/nearly-headless-cms/test/filesystem/filesystem-commit-boundary-scenarios-imports.ts:7`
- `packages/nearly-headless-cms/test/filesystem/filesystem-commit-boundary-scenarios-imports.ts:9`
- `packages/nearly-headless-cms/test/filesystem/filesystem-concurrency-fault-scenarios-imports.ts:7`
- `packages/nearly-headless-cms/test/filesystem/filesystem-concurrency-fault-scenarios-imports.ts:9`
- `packages/nearly-headless-cms/test/filesystem/filesystem-fault-injection-manifest-scenarios-imports.ts:7`
- `packages/nearly-headless-cms/test/filesystem/filesystem-fault-injection-scenarios-imports.ts:7`
- `packages/nearly-headless-cms/test/filesystem/filesystem-path-invariant-scenarios.ts:9`
- `packages/nearly-headless-cms/test/filesystem/filesystem-persistence-corruption-scenarios.ts:6`
- `packages/nearly-headless-cms/test/filesystem/filesystem-persistence-scenarios.ts:35`
- `packages/nearly-headless-cms/test/filesystem/filesystem-persistence-writer-scenarios.ts:10`

#### EH-150: Standalone CLI resolves repository paths before any Effect application exists.

**Locations:**

- `scripts/check-architecture.ts:2`
- `scripts/escape-hatches-parse-support.ts:2`
- `scripts/package-portability-smoke.ts:1`
- `scripts/record-release-evidence.ts:1`
- `scripts/release.ts:1`
- `scripts/run-acceptance.ts:2`

#### EH-151: Temporary upload staging requires node fs primitives unavailable in the HTTP FileSystem abstraction.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-request-parsing-support.ts:11`
- `packages/nearly-headless-cms/src/http/http-transport-request-parsing-support.ts:15`

#### EH-152: Temporary upload staging requires node os primitives unavailable in the HTTP FileSystem abstraction.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-request-parsing-support.ts:19`

#### EH-153: Temporary upload staging requires node path primitives unavailable in the HTTP FileSystem abstraction.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-request-parsing-support.ts:17`

#### EH-154: The test exercises the Bun filesystem adapter's on-disk behavior; these helpers have no Bun equivalent.

**Locations:**

- `packages/nearly-headless-cms/test/filesystem/filesystem-commit-boundary-child-scenarios-imports.ts:9`
- `packages/nearly-headless-cms/test/filesystem/filesystem-commit-boundary-scenarios-imports.ts:5`
- `packages/nearly-headless-cms/test/filesystem/filesystem-concurrency-fault-scenarios-imports.ts:5`
- `packages/nearly-headless-cms/test/filesystem/filesystem-fault-injection-manifest-scenarios-imports.ts:5`
- `packages/nearly-headless-cms/test/filesystem/filesystem-fault-injection-scenarios-imports.ts:5`
- `packages/nearly-headless-cms/test/filesystem/filesystem-path-invariant-scenarios.ts:11`
- `packages/nearly-headless-cms/test/filesystem/filesystem-persistence-corruption-scenarios.ts:8`
- `packages/nearly-headless-cms/test/filesystem/filesystem-persistence-scenarios.ts:32`
- `packages/nearly-headless-cms/test/filesystem/filesystem-persistence-writer-scenarios.ts:12`

#### EH-155: This Bun adapter needs durable fsync/open and directory primitives unavailable in Effect's portable FileSystem layer.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-io.ts:14`
- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-root-imports.ts:12`
- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-root-load-imports.ts:6`
- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-support-imports.ts:15`

### Effect · `effecttsgo/prefer-schema-over-json`

#### EH-156: request bodies are OpenAPI-generated unknown shapes and must be serialized using the browser JSON boundary.

**Locations:**

- `apps/example-cms/src/generated/headless-openapi-client-runtime-transport-request-support.ts:37`
- `apps/example-cms/src/generated/management-openapi-client-runtime-transport-request-support.ts:37`
- `apps/public-blog/src/core/generated/headless-openapi-client-runtime-transport-request-support.ts:37`
- `scripts/openapi-client-generator/runtime-template.ts:229`

### Effect · `effecttsgo/run-effect-inside-effect`

#### EH-157: bridge the abort callback into Promise.race.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-request-timeout-support.ts:84`

#### EH-158: interrupt the owned timer fiber during Web handler cleanup.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-request-timeout-support.ts:111`

#### EH-159: this Web handler owns a timer fiber outside the request Effect.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-request-timeout-support.ts:105`

### Effect · `effecttsgo/strict-effect-provide`

#### EH-160: acceptance journey entry point needs a fresh isolated layer.

**Locations:**

- `packages/nearly-headless-cms/test/integration/definition-migration-journey-scenarios.ts:70`

#### EH-161: test entry point needs a fresh isolated layer per run.

**Locations:**

- `packages/nearly-headless-cms/test/contract/authorization-expansion-support.ts:65`
- `packages/nearly-headless-cms/test/integration/cms-service.test.ts:44`
- `packages/nearly-headless-cms/test/integration/definition-lifecycle.test.ts:19`
- `packages/nearly-headless-cms/test/integration/definition-lifecycle.test.ts:25`
- `packages/nearly-headless-cms/test/integration/definition-lifecycle.test.ts:31`
- `packages/nearly-headless-cms/test/integration/entry-history.test.ts:17`

#### EH-162: test entry point needs a fresh isolated layer.

**Locations:**

- `packages/nearly-headless-cms/test/contract/http-contract-deletion-scenarios.ts:19`
- `packages/nearly-headless-cms/test/contract/http-contract-management-scenarios.ts:20`
- `packages/nearly-headless-cms/test/contract/http-contract-multipart-scenarios.ts:48`
- `packages/nearly-headless-cms/test/contract/http-contract-transport-scenarios.ts:46`
- `packages/nearly-headless-cms/test/contract/http-contract-transport-scenarios.ts:66`
- `packages/nearly-headless-cms/test/filesystem/filesystem-commit-boundary-child-scenarios.ts:22`
- `packages/nearly-headless-cms/test/filesystem/filesystem-commit-boundary-scenarios.ts:20`
- `packages/nearly-headless-cms/test/filesystem/filesystem-concurrency-fault-scenarios.ts:40`
- `packages/nearly-headless-cms/test/filesystem/filesystem-fault-injection-manifest-scenarios.ts:47`
- `packages/nearly-headless-cms/test/filesystem/filesystem-fault-injection-scenarios.ts:26`
- `packages/nearly-headless-cms/test/filesystem/filesystem-fault-injection-scenarios.ts:34`
- `packages/nearly-headless-cms/test/filesystem/filesystem-path-invariant-scenarios.ts:32`
- `packages/nearly-headless-cms/test/filesystem/filesystem-path-invariant-scenarios.ts:42`
- `packages/nearly-headless-cms/test/filesystem/filesystem-persistence-corruption-scenarios.ts:32`
- `packages/nearly-headless-cms/test/filesystem/filesystem-persistence-scenarios.ts:207`
- `packages/nearly-headless-cms/test/filesystem/filesystem-persistence-writer-scenarios.ts:24`
- `packages/nearly-headless-cms/test/filesystem/filesystem-persistence-writer-scenarios.ts:34`
- `packages/nearly-headless-cms/test/integration/asset-http-delivery.test.ts:24`
- `packages/nearly-headless-cms/test/integration/http-socket-integration-backpressure-scenarios.ts:20`
- `packages/nearly-headless-cms/test/integration/http-socket-integration-body-limit-scenarios.ts:31`
- `packages/nearly-headless-cms/test/integration/http-socket-integration-disconnect-scenarios.ts:26`
- `packages/nearly-headless-cms/test/integration/http-socket-integration-multipart-scenarios.ts:45`
- `packages/nearly-headless-cms/test/integration/http-socket-integration-scenarios.ts:12`
- `packages/nearly-headless-cms/test/integration/http-socket-integration-slow-producer-scenarios.ts:20`
- `packages/nearly-headless-cms/test/integration/http-socket-integration-timeout-scenarios.ts:27`

### ESLint · `eslint/func-style`

#### EH-163: error status helpers are function declarations to keep CmsError Schema narrowing readable.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-response.ts:40`
- `packages/nearly-headless-cms/src/http/http-transport-response.ts:56`
- `packages/nearly-headless-cms/src/http/http-transport-response.ts:67`
- `packages/nearly-headless-cms/src/http/http-transport-response.ts:78`
- `packages/nearly-headless-cms/src/http/http-transport-response.ts:92`
- `packages/nearly-headless-cms/src/http/http-transport-response.ts:103`
- `packages/nearly-headless-cms/src/http/http-transport-response.ts:114`
- `packages/nearly-headless-cms/src/http/http-transport-response.ts:125`
- `packages/nearly-headless-cms/src/http/http-transport-response.ts:144`

### ESLint · `eslint/init-declarations`

#### EH-164: axe script server starts lazily when acceptance servers are ready.

**Locations:**

- `acceptance/accessibility/axe-webview.test.ts:10`

### ESLint · `eslint/max-lines-per-function`

#### EH-165: child spawn script must stay in one function for eval readability.

**Locations:**

- `packages/nearly-headless-cms/test/filesystem/filesystem-commit-boundary-child-spawn.ts:10`

#### EH-166: escape hatch document rendering is intentionally colocated.

**Locations:**

- `scripts/escape-hatches-render-support.ts:38`

#### EH-167: escape hatch parsing and rendering are intentionally colocated.

**Locations:**

- `scripts/escape-hatches-parse-support.ts:85`

#### EH-168: escape hatch registry CLI uses async filesystem IO.

**Locations:**

- `scripts/escape-hatches-registry-support.ts:69`
- `scripts/escape-hatches-registry-support.ts:166`

#### EH-169: React panel helpers exceed function line budget after typed prop alias escape hatches.

**Locations:**

- `apps/example-cms/src/presentation/assets-page-dialogs-support.tsx:110`
- `apps/example-cms/src/presentation/assets-page-header-support.tsx:4`
- `apps/example-cms/src/presentation/assets-page-header-support.tsx:104`
- `apps/example-cms/src/presentation/assets-page-panels-support.tsx:51`
- `apps/example-cms/src/presentation/entry-editor-publication-panel-sections-support.tsx:50`
- `apps/example-cms/src/presentation/entry-editor-story-canvas-fields-support.tsx:61`
- `apps/example-cms/src/presentation/entry-editor-story-canvas-support.tsx:33`

#### EH-170: shutdown scenario keeps orchestration in one place for readability.

**Locations:**

- `packages/nearly-headless-cms/test/integration/http-socket-integration-shutdown-scenarios.ts:9`

### ESLint · `eslint/max-params`

#### EH-171: escape hatch parsing and rendering are intentionally colocated.

**Locations:**

- `scripts/escape-hatches-parse-support.ts:85`

### ESLint · `eslint/max-statements`

#### EH-172: escape hatch document rendering is intentionally colocated.

**Locations:**

- `scripts/escape-hatches-render-support.ts:38`

#### EH-173: escape hatch parsing and rendering are intentionally colocated.

**Locations:**

- `scripts/escape-hatches-parse-support.ts:85`

#### EH-174: escape hatch registry CLI uses async filesystem IO.

**Locations:**

- `scripts/escape-hatches-registry-support.ts:11`
- `scripts/escape-hatches-registry-support.ts:69`
- `scripts/escape-hatches-registry-support.ts:166`
- `scripts/escape-hatches-support.ts:8`

#### EH-175: registry formatting keeps comment rendering colocated.

**Locations:**

- `scripts/escape-hatches-registry-support.ts:47`

#### EH-176: registry rendering keeps family grouping colocated.

**Locations:**

- `scripts/escape-hatches-render-support.ts:72`

#### EH-287: escape hatch registry CLI keeps command dispatch in one entrypoint.

**Locations:**

- `scripts/escape-hatches-support.ts:36`

#### EH-291: escape hatch maintenance updates source files sequentially to preserve formatting.

**Locations:**

- `scripts/escape-hatches-strip-support.ts:65`

### ESLint · `eslint/no-await-in-loop`

#### EH-177: file scans and updates must preserve source order.

**Locations:**

- `scripts/escape-hatches-parse-support.ts:170`
- `scripts/escape-hatches-registry-support.ts:179`
- `scripts/escape-hatches-registry-support.ts:200`

#### EH-283: escape hatch maintenance updates source files sequentially to preserve formatting.

**Locations:**

- `scripts/escape-hatches-strip-support.ts:65`
- `scripts/escape-hatches-strip-support.ts:77`

#### EH-288: escape hatch maintenance reads source files sequentially to preserve formatting.

**Locations:**

- `scripts/escape-hatches-strip-support.ts:69`

### ESLint · `eslint/no-continue`

#### EH-178: registry assignment skips unresolved rule and code pairs.

**Locations:**

- `scripts/escape-hatches-registry-support.ts:25`
- `scripts/escape-hatches-registry-support.ts:132`
- `scripts/escape-hatches-registry-support.ts:138`

### ESLint · `eslint/no-ternary`

#### EH-179: generated fetch bridge keeps compact signal fallback.

**Locations:**

- `apps/example-cms/src/generated/headless-openapi-client-runtime-transport.ts:54`
- `apps/example-cms/src/generated/management-openapi-client-runtime-transport.ts:54`
- `apps/public-blog/src/core/generated/headless-openapi-client-runtime-transport.ts:54`
- `scripts/openapi-client-generator/runtime-template.ts:147`

#### EH-180: registry formatting keeps compact comment labels.

**Locations:**

- `scripts/escape-hatches-registry-support.ts:52`
- `scripts/escape-hatches-registry-support.ts:60`
- `scripts/escape-hatches-registry-support.ts:197`

#### EH-181: registry helpers keep related declarations grouped.

**Locations:**

- `scripts/escape-hatches-parse-support.ts:125`
- `scripts/escape-hatches-parse-support.ts:127`

#### EH-284: reindex mode chooses between fresh sequential codes and preserved registry codes.

**Locations:**

- `scripts/escape-hatches-registry-support.ts:112`
- `scripts/escape-hatches-registry-support.ts:115`

#### EH-289: reindex mode chooses between an empty code map and the persisted registry map.

**Locations:**

- `scripts/escape-hatches-registry-support.ts:88`

### ESLint · `eslint/one-var`

#### EH-182: commit exit must follow the chmod yield before assertions.

**Locations:**

- `packages/nearly-headless-cms/test/filesystem/filesystem-fault-injection-scenarios.ts:89`

#### EH-183: commit exit must follow the manifest obstruction yield before assertions.

**Locations:**

- `packages/nearly-headless-cms/test/filesystem/filesystem-fault-injection-manifest-scenarios.ts:61`

#### EH-184: conflict setup reads entry state after the editor finishes loading.

**Locations:**

- `acceptance/visual/visual-baseline-scenarios.ts:177`
- `acceptance/visual/visual-baseline-scenarios.ts:184`

#### EH-185: CORS header mutation follows the origin allowlist guard.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-preflight-support.ts:33`

#### EH-186: exported bindings follow private fixture resolution in the same module.

**Locations:**

- `acceptance/accessibility/axe-webview-support.ts:57`

#### EH-187: helpers with readonly disables must stay as separate const declarations.

**Locations:**

- `packages/nearly-headless-cms/src/cms-entry-expansion-relationship-support.ts:93`
- `packages/nearly-headless-cms/src/cms-entry-expansion-relationship-support.ts:138`
- `packages/nearly-headless-cms/src/entry-query-projection.ts:13`

#### EH-188: query response body and first item are parsed together after the status guard.

**Locations:**

- `acceptance/visual/visual-baseline-management-support.ts:35`

#### EH-189: read-back must follow manifest obstruction cleanup before assertions.

**Locations:**

- `packages/nearly-headless-cms/test/filesystem/filesystem-fault-injection-manifest-scenarios.ts:81`

#### EH-190: read-back must follow the restore-chmod yield before assertions.

**Locations:**

- `packages/nearly-headless-cms/test/filesystem/filesystem-fault-injection-scenarios.ts:109`

#### EH-191: registry formatting keeps compact comment labels.

**Locations:**

- `scripts/escape-hatches-registry-support.ts:197`

#### EH-192: registry helpers keep related declarations grouped.

**Locations:**

- `scripts/escape-hatches-parse-support.ts:114`
- `scripts/escape-hatches-parse-support.ts:121`
- `scripts/escape-hatches-parse-support.ts:127`
- `scripts/escape-hatches-parse-support.ts:130`
- `scripts/escape-hatches-registry-support.ts:17`
- `scripts/escape-hatches-registry-support.ts:28`
- `scripts/escape-hatches-registry-support.ts:57`
- `scripts/escape-hatches-registry-support.ts:135`
- `scripts/escape-hatches-registry-support.ts:141`
- `scripts/escape-hatches-support.ts:27`
- `scripts/escape-hatches-support.ts:58`

#### EH-193: registry parsing uses ASCII comment markers only.

**Locations:**

- `scripts/escape-hatches-parse-support.ts:74`
- `scripts/escape-hatches-parse-support.ts:96`

#### EH-194: transport startup keeps separate statements so lint autofix does not merge dependency-ordered locals.

**Locations:**

- `packages/nearly-headless-cms/src/bun/http/bun-http-transport-support.ts:21`
- `packages/nearly-headless-cms/src/bun/http/bun-http-transport-support.ts:23`
- `packages/nearly-headless-cms/src/bun/http/bun-http-transport-support.ts:38`
- `packages/nearly-headless-cms/src/bun/http/bun-http-transport-support.ts:40`

#### EH-290: reindex mode chooses between an empty code map and the persisted registry map.

**Locations:**

- `scripts/escape-hatches-registry-support.ts:88`

#### EH-307: delivery operation assembly stays separate from schema constants.

**Locations:**

- `apps/example-cms-minimal/src/core/delivery.ts:33`

#### EH-308: digest and response headers are derived after the size guard.

**Locations:**

- `packages/nearly-headless-cms/src/http/delivery-recipes/public-export.ts:94`

#### EH-309: digest helpers stay grouped in one local const block below exported defaults.

**Locations:**

- `packages/nearly-headless-cms/src/http/delivery-recipes/public-export.ts:36`

#### EH-310: transport helpers stay in one local const block below exported pagination constants.

**Locations:**

- `packages/nearly-headless-cms/src/http/delivery-recipes/pagination.ts:13`

### ESLint · `eslint/require-unicode-regexp`

#### EH-195: registry parsing uses ASCII comment markers only.

**Locations:**

- `scripts/escape-hatches-parse-support.ts:30`
- `scripts/escape-hatches-parse-support.ts:34`
- `scripts/escape-hatches-parse-support.ts:37`
- `scripts/escape-hatches-parse-support.ts:65`
- `scripts/escape-hatches-parse-support.ts:74`
- `scripts/escape-hatches-parse-support.ts:96`
- `scripts/escape-hatches-parse-support.ts:116`
- `scripts/escape-hatches-render-support.ts:19`
- `scripts/escape-hatches-support.ts:20`

### ESLint · `no-await-in-loop`

#### EH-196: checks intentionally run sequentially.

**Locations:**

- `scripts/check-architecture.ts:244`

#### EH-197: cleanup must remain sequential.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-root.ts:106`

#### EH-198: handlers must run sequentially until one matches.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-route-dispatch.ts:13`

#### EH-199: preserve ordered chunk writes.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-request-parsing-support.ts:267`

#### EH-200: recursive cleanup must remain sequential.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-root.ts:110`

### Unicorn · `unicorn/no-array-sort`

#### EH-277: registry keys are sorted in place before code assignment.

**Locations:**

- `scripts/escape-hatches-parse-support.ts:53`
- `scripts/escape-hatches-registry-support.ts:92`

### Unicorn · `unicorn/prefer-number-coercion`

#### EH-278: registry code numbers are parsed from fixed-width labels.

**Locations:**

- `scripts/escape-hatches-registry-support.ts:39`
- `scripts/escape-hatches-render-support.ts:24`

### Unicorn · `unicorn/prefer-ternary`

#### EH-279: registry defaults keep explicit branch justifications.

**Locations:**

- `scripts/escape-hatches-parse-support.ts:146`

#### EH-280: registry formatting keeps compact comment labels.

**Locations:**

- `scripts/escape-hatches-registry-support.ts:52`
- `scripts/escape-hatches-registry-support.ts:60`
