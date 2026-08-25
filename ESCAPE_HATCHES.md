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
- **EH-101** (`effecttsgo/node-builtin-import`): Bun does not provide a path manipulation API; these operations are platform-neutral string handling.
- **EH-102** (`effecttsgo/node-builtin-import`): Standalone CLI resolves repository paths before any Effect application exists.
- **EH-103** (`effecttsgo/node-builtin-import`): Temporary upload staging requires node fs primitives unavailable in the HTTP FileSystem abstraction.
- **EH-104** (`effecttsgo/node-builtin-import`): Temporary upload staging requires node os primitives unavailable in the HTTP FileSystem abstraction.
- **EH-105** (`effecttsgo/node-builtin-import`): Temporary upload staging requires node path primitives unavailable in the HTTP FileSystem abstraction.
- **EH-106** (`effecttsgo/node-builtin-import`): This Bun adapter needs durable fsync/open and directory primitives unavailable in Effect's portable FileSystem layer.
- **EH-107** (`effecttsgo/prefer-schema-over-json`): request bodies are OpenAPI-generated unknown shapes and must be serialized using the browser JSON boundary.
- **EH-108** (`effecttsgo/run-effect-inside-effect`): bridge the abort callback into Promise.race.
- **EH-109** (`effecttsgo/run-effect-inside-effect`): interrupt the owned timer fiber during Web handler cleanup.
- **EH-110** (`effecttsgo/run-effect-inside-effect`): this Web handler owns a timer fiber outside the request Effect.
- **EH-111** (`effecttsgo/strict-effect-provide`): test entry point needs a fresh isolated layer per run.
- **EH-112** (`effecttsgo/strict-effect-provide`): test entry point needs a fresh isolated layer.
- **EH-113** (`eslint/func-style`): error status helpers are function declarations to keep CmsError Schema narrowing readable.
- **EH-118** (`eslint/max-lines-per-function`): escape hatch parsing and rendering are intentionally colocated.
- **EH-120** (`eslint/no-await-in-loop`): file scans and updates must preserve source order.
- **EH-121** (`eslint/no-continue`): registry assignment skips unresolved rule and code pairs.
- **EH-124** (`eslint/no-ternary`): registry formatting keeps compact comment labels.
- **EH-125** (`eslint/one-var`): helpers with readonly disables must stay as separate const declarations.
- **EH-126** (`eslint/one-var`): registry helpers keep related declarations grouped.
- **EH-127** (`eslint/require-unicode-regexp`): registry parsing uses ASCII comment markers only.
- **EH-128** (`eslint/sort-imports`): export route imports follow dependency grouping.
- **EH-129** (`eslint/sort-imports`): history panel imports follow UI dependency grouping.
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
- **EH-210** (`effecttsgo/node-builtin-import`): Baseline paths are test-runner setup paths; there is no Effect runtime involved in this Bun test.
- **EH-211** (`effecttsgo/node-builtin-import`): Path joining is host-path setup for this filesystem integration test, outside the Effect service graph.
- **EH-212** (`effecttsgo/node-builtin-import`): The test exercises the Bun filesystem adapter's on-disk behavior; these helpers have no Bun equivalent.
- **EH-214** (`unicorn/prefer-number-coercion`): registry code numbers are parsed from fixed-width labels.
- **EH-215** (`unicorn/prefer-ternary`): registry defaults keep explicit branch justifications.
- **EH-216** (`eslint/max-lines-per-function`): escape hatch registry CLI uses async filesystem IO.
- **EH-217** (`eslint/max-lines-per-function`): React panel helpers exceed function line budget after typed prop alias escape hatches.
- **EH-218** (`eslint/max-params`): escape hatch parsing and rendering are intentionally colocated.
- **EH-219** (`eslint/max-statements`): escape hatch parsing and rendering are intentionally colocated.
- **EH-220** (`eslint/max-statements`): escape hatch registry CLI uses async filesystem IO.
- **EH-221** (`eslint/one-var`): registry formatting keeps compact comment labels.
- **EH-223** (`eslint/one-var`): registry parsing uses ASCII comment markers only.
- **EH-225** (`eslint/sort-vars`): escape hatch registry CLI uses async filesystem IO.
- **EH-226** (`eslint/sort-vars`): registry formatting keeps compact comment labels.
- **EH-227** (`effecttsgo/async-function`): escape hatch registry helpers are intentionally direct-call only.
- **EH-228** (`effecttsgo/missing-pipeable-signature`): escape hatch registry helpers are intentionally direct-call only.
- **EH-229** (`eslint/max-statements`): registry formatting keeps comment rendering colocated.
- **EH-230** (`eslint/no-ternary`): registry helpers keep related declarations grouped.
- **EH-231** (`eslint/sort-vars`): escape hatch registry helpers are intentionally direct-call only.
- **EH-232** (`eslint/sort-vars`): registry formatting keeps comment rendering colocated.
- **EH-233** (`eslint/sort-vars`): registry helpers keep related declarations grouped.
- **EH-234** (`unicorn/prefer-ternary`): registry formatting keeps compact comment labels.
- **EH-235** (`effecttsgo/global-fetch`): generated clients intentionally use the platform fetch boundary so callers can supply the browser or server runtime.
- **EH-236** (`effecttsgo/global-fetch-in-effect`): generated clients intentionally use the platform fetch boundary so callers can supply the browser or server runtime.
- **EH-237** (`eslint/no-ternary`): generated fetch bridge keeps compact signal fallback.
- **EH-238** (`eslint/sort-imports`): multi-specifier type imports precede single-specifier imports in this validation module.
- **EH-239** (`typescript/prefer-readonly-parameter-types`): document line buffer is mutated while rendering the registry.
- **EH-240** (`eslint/max-lines-per-function`): escape hatch document rendering is intentionally colocated.
- **EH-241** (`eslint/max-statements`): escape hatch document rendering is intentionally colocated.
- **EH-242** (`eslint/max-statements`): registry rendering keeps family grouping colocated.
- **EH-243** (`effecttsgo/abort-controller-in-effect`): transport shutdown keeps one shared AbortController for in-flight Web requests.
- **EH-244** (`effecttsgo/async-function`): lifecycle wrapper is a Web-standard Promise<Response> callback.
- **EH-245** (`effecttsgo/global-fetch`): integration test exercises an in-flight request during shutdown drain.
- **EH-246** (`effecttsgo/global-fetch`): integration test exercises rejection during shutdown drain.
- **EH-247** (`effecttsgo/global-fetch`): integration test exercises the live HTTP listener through the platform fetch boundary.
- **EH-248** (`effecttsgo/global-fetch`): integration test starts a request that outlives the drain window.
- **EH-249** (`effecttsgo/global-timers`): pre-shutdown delay starts drain while the slow request remains active.
- **EH-250** (`effecttsgo/global-timers`): slow handler delay mirrors a peer that keeps the connection open.
- **EH-251** (`effecttsgo/new-promise`): hanging handler keeps the socket open until forced shutdown.
- **EH-252** (`effecttsgo/new-promise`): shutdown timing is coordinated through Promise composition in the socket test.
- **EH-253** (`effecttsgo/new-promise`): slow handler simulates an in-flight socket request outside Effect.
- **EH-254** (`eslint/max-lines-per-function`): shutdown scenario keeps orchestration in one place for readability.
- **EH-255** (`eslint/one-var`): transport startup keeps separate statements so lint autofix does not merge dependency-ordered locals.
- **EH-256** (`eslint/sort-imports`): Bun transport layer imports follow handler, Effect, and transport dependency order.
- **EH-257** (`eslint/sort-imports`): Bun transport startup imports follow Effect, failure mapping, and lifecycle dependency order.
- **EH-258** (`eslint/sort-vars`): archive path depends on the resolved package manifest version.
- **EH-259** (`eslint/sort-vars`): branch text is trimmed immediately into the release evidence artifact field.
- **EH-260** (`eslint/sort-vars`): commit text is trimmed immediately into the release evidence artifact field.
- **EH-261** (`eslint/sort-vars`): evidence object aggregates the resolved release metadata fields.
- **EH-262** (`eslint/sort-vars`): export programs are declared before the runtime that executes them.
- **EH-263** (`eslint/sort-vars`): fixture install helpers are declared before the export programs that call them.
- **EH-264** (`eslint/sort-vars`): forced shutdown locals follow lifecycle, handler, and server order.
- **EH-265** (`eslint/sort-vars`): generated-at text is trimmed immediately into the release evidence artifact field.
- **EH-266** (`eslint/sort-vars`): handler effect is declared before the form factory it configures.
- **EH-267** (`eslint/sort-vars`): hanging handler follows lifecycle construction.
- **EH-268** (`eslint/sort-vars`): inspection report parsing follows the resolved archive and git metadata fields.
- **EH-269** (`eslint/sort-vars`): lifecycle construction follows slow handler setup.
- **EH-270** (`eslint/sort-vars`): lifecycle helpers follow drain, force-stop, hook, wrap, and factory order.
- **EH-271** (`eslint/sort-vars`): live server follows hanging handler construction.
- **EH-272** (`eslint/sort-vars`): response verifiers follow the HTTP scenario narrative order.
- **EH-273** (`eslint/sort-vars`): server startup follows lifecycle construction.
- **EH-274** (`eslint/sort-vars`): shutdown scenario locals follow handler, server, and request order.
- **EH-275** (`eslint/sort-vars`): slow handler factory precedes lifecycle and server setup.
- **EH-276** (`typescript/prefer-readonly-parameter-types`): drain polling reads shared active-request counters without mutating them.
- **EH-277** (`typescript/prefer-readonly-parameter-types`): HttpTransport handler mirrors the Web Request callback contract.
- **EH-278** (`typescript/prefer-readonly-parameter-types`): Layer factory accepts optional builder configuration without mutation.
- **EH-279** (`typescript/prefer-readonly-parameter-types`): RequestInit is passed directly into the Web Request constructor.
- **EH-280** (`typescript/prefer-readonly-parameter-types`): shutdown mutates shared lifecycle counters and abort controllers.
- **EH-281** (`typescript/prefer-readonly-parameter-types`): wrapped handlers mutate shared active-request counters.
- **EH-282** (`effecttsgo/global-fetch`): integration test exercises multipart upload through the live HTTP listener.
- **EH-283** (`effecttsgo/node-builtin-import`): Journey setup creates an isolated filesystem root before the CMS layer starts.
- **EH-284** (`effecttsgo/node-builtin-import`): Path joining is host-path setup for this acceptance journey, outside the Effect service graph.
- **EH-285** (`effecttsgo/strict-effect-provide`): acceptance journey entry point needs a fresh isolated layer.
- **EH-286** (`eslint/one-var`): commit exit must follow the chmod yield before assertions.
- **EH-287** (`eslint/one-var`): read-back must follow the restore-chmod yield before assertions.
- **EH-288** (`effecttsgo/global-fetch`): integration test aborts an in-flight request against the live HTTP listener.
- **EH-289** (`effecttsgo/global-fetch`): integration test exercises request timeout through the live HTTP listener.
- **EH-293** (`eslint/max-lines-per-function`): child spawn script must stay in one function for eval readability.
- **EH-296** (`eslint/sort-imports`): child spawn imports follow bun, node, and support dependency order.
- **EH-299** (`eslint/one-var`): commit exit must follow the manifest obstruction yield before assertions.
- **EH-300** (`eslint/one-var`): read-back must follow manifest obstruction cleanup before assertions.
- **EH-301** (`eslint/sort-vars`): commit helper closes over firstEntryIdentifier declared above.
- **EH-302** (`effecttsgo/async-function`): slow consumer reads intentionally await Bun.sleep between stream chunks; readNextChunk closes over reader.
- **EH-303** (`effecttsgo/global-fetch`): integration test exercises JSON body limits through the live HTTP listener.
- **EH-304** (`effecttsgo/global-fetch`): integration test streams an Asset download through the live HTTP listener.
- **EH-305** (`effecttsgo/global-fetch`): integration test uploads an Asset through the live HTTP listener.
- **EH-306** (`eslint/sort-vars`): slow consumer reads intentionally await Bun.sleep between stream chunks; readNextChunk closes over reader.
- **EH-307** (`eslint/sort-vars`): submissions path follows handler construction in this socket scenario.
- **EH-308** (`eslint/sort-vars`): upload path follows handler construction in this socket scenario.
- **EH-309** (`effecttsgo/global-fetch`): integration test uploads a paced multipart Asset body through the live HTTP listener.
- **EH-310** (`eslint/sort-vars`): paced multipart body closes over header and footer bytes declared above.
- **EH-311** (`effecttsgo/async-function`): axe acceptance scans compose awaited WebView navigation and evaluation.
- **EH-312** (`effecttsgo/async-function`): WebView readiness polling composes awaited evaluation and sleep.
- **EH-313** (`effecttsgo/node-builtin-import`): Accessibility test setup resolves axe-core from node_modules before any Effect application exists.
- **EH-314** (`eslint/init-declarations`): axe script server starts lazily when acceptance servers are ready.
- **EH-315** (`eslint/one-var`): exported bindings follow private fixture resolution in the same module.
- **EH-316** (`typescript/no-unsafe-type-assertion`): allowlist JSON is versioned repository fixture data validated at acceptance runtime.
- **EH-317** (`effecttsgo/node-builtin-import`): fileURLToPath converts Bun module resolution URLs into filesystem paths for axe-core serving.
- **EH-318** (`effecttsgo/async-function`): visual baseline preparation composes awaited WebView navigation and evaluation.
- **EH-319** (`effecttsgo/async-function`): visual baseline setup queries the live Example CMS management API.
- **EH-320** (`effecttsgo/async-function`): visual baseline setup reads the live Example CMS management API.
- **EH-321** (`effecttsgo/async-function`): visual baseline setup writes through the live Example CMS management API.
- **EH-322** (`effecttsgo/global-fetch`): visual baseline setup queries the live Example CMS management API.
- **EH-323** (`effecttsgo/global-fetch`): visual baseline setup reads the live Example CMS management API.
- **EH-324** (`effecttsgo/global-fetch`): visual baseline setup writes through the live Example CMS management API.
- **EH-325** (`eslint/one-var`): query response body and first item are parsed together after the status guard.
- **EH-326** (`effecttsgo/async-function`): interactive visual scenarios reset mutated Example CMS fixture entries.
- **EH-328** (`effecttsgo/async-function`): visual baseline polling composes sequential WebView evaluation and sleep.
- **EH-329** (`effecttsgo/missing-pipeable-signature`): interactive visual scenarios reset mutated Example CMS fixture entries.
- **EH-330** (`effecttsgo/missing-pipeable-signature`): visual baseline setup queries the live Example CMS management API.
- **EH-331** (`effecttsgo/missing-pipeable-signature`): visual baseline setup reads the live Example CMS management API.
- **EH-332** (`effecttsgo/missing-pipeable-signature`): visual baseline setup writes through the live Example CMS management API.
- **EH-334** (`effecttsgo/async-function`): visual baseline setup prepares invalid draft publication state through the management API.
- **EH-335** (`eslint/one-var`): conflict setup reads entry state after the editor finishes loading.
- **EH-336** (`eslint/one-var`): CORS header mutation follows the origin allowlist guard.
- **EH-337** (`eslint/sort-vars`): draft identifiers are resolved before lighthouse fixture values are copied.
- **EH-339** (`effecttsgo/async-function`): editor navigation depends on waitUntilExpression despite alphabetical ordering.
- **EH-341** (`eslint/sort-vars`): editor navigation depends on waitUntilExpression despite alphabetical ordering.
- **EH-342** (`eslint/sort-vars`): featured asset selection follows lighthouse fixture lookup.
- **EH-344** (`effecttsgo/async-function`): conflict preparation follows controlled input setup despite alphabetical ordering.
- **EH-345** (`eslint/sort-vars`): conflict preparation follows controlled input setup despite alphabetical ordering.
- **EH-346** (`effecttsgo/async-function`): controlled input updates precede conflict preparation despite alphabetical ordering.
- **EH-347** (`eslint/sort-vars`): controlled input updates precede conflict preparation despite alphabetical ordering.
- **EH-348** (`effecttsgo/async-function`): journey orchestration follows helper dependency order despite alphabetical ordering.
- **EH-349** (`eslint/sort-vars`): journey orchestration follows helper dependency order despite alphabetical ordering.

## Justification Registry

Grouped by linter family and rule. Entries within each rule are sorted by code.

### TypeScript · `@ts-expect-error`

#### EH-001: Arbitrary private subpaths are not public package exports.

**Locations:**

- `packages/nearly-headless-cms/test/types/public-api.ts:28`

### TypeScript · `typescript/no-unnecessary-type-parameters`

#### EH-139: React panel helpers preserve local prop aliases for component call sites.

**Locations:**

- `apps/example-cms/src/ui/assets-page-dialogs-support.tsx:4`
- `apps/example-cms/src/ui/assets-page-dialogs-support.tsx:13`
- `apps/example-cms/src/ui/assets-page-dialogs-support.tsx:41`
- `apps/example-cms/src/ui/assets-page-dialogs-support.tsx:50`
- `apps/example-cms/src/ui/assets-page-dialogs-support.tsx:83`
- `apps/example-cms/src/ui/assets-page-dialogs-support.tsx:110`
- `apps/example-cms/src/ui/assets-page-dialogs-support.tsx:112`
- `apps/example-cms/src/ui/assets-page-dialogs-support.tsx:114`
- `apps/example-cms/src/ui/assets-page-header-support.tsx:5`
- `apps/example-cms/src/ui/assets-page-header-support.tsx:7`
- `apps/example-cms/src/ui/assets-page-header-support.tsx:9`
- `apps/example-cms/src/ui/assets-page-header-support.tsx:15`
- `apps/example-cms/src/ui/assets-page-header-support.tsx:58`
- `apps/example-cms/src/ui/assets-page-header-support.tsx:60`
- `apps/example-cms/src/ui/assets-page-header-support.tsx:62`
- `apps/example-cms/src/ui/assets-page-header-support.tsx:68`
- `apps/example-cms/src/ui/assets-page-header-support.tsx:105`
- `apps/example-cms/src/ui/assets-page-header-support.tsx:114`
- `apps/example-cms/src/ui/assets-page-header-support.tsx:120`
- `apps/example-cms/src/ui/assets-page-panels-support.tsx:11`
- `apps/example-cms/src/ui/assets-page-panels-support.tsx:13`
- `apps/example-cms/src/ui/assets-page-panels-support.tsx:15`
- `apps/example-cms/src/ui/assets-page-panels-support.tsx:21`
- `apps/example-cms/src/ui/assets-page-panels-support.tsx:23`
- `apps/example-cms/src/ui/assets-page-panels-support.tsx:56`
- `apps/example-cms/src/ui/assets-page-panels-support.tsx:58`
- `apps/example-cms/src/ui/assets-page-panels-support.tsx:60`
- `apps/example-cms/src/ui/assets-page-panels-support.tsx:66`
- `apps/example-cms/src/ui/assets-page-panels-support.tsx:68`
- `apps/example-cms/src/ui/assets-page-panels-support.tsx:122`
- `apps/example-cms/src/ui/assets-page-panels-support.tsx:124`
- `apps/example-cms/src/ui/assets-page-panels-support.tsx:126`
- `apps/example-cms/src/ui/assets-page-panels-support.tsx:132`
- `apps/example-cms/src/ui/assets-page-panels-support.tsx:134`
- `apps/example-cms/src/ui/entry-editor-controller-local-state-support.ts:18`
- `apps/example-cms/src/ui/entry-editor-controller-local-state-support.ts:20`
- `apps/example-cms/src/ui/entry-editor-controller-local-state-support.ts:67`
- `apps/example-cms/src/ui/entry-editor-controller-view-actions-support.ts:4`
- `apps/example-cms/src/ui/entry-editor-controller-view-actions-support.ts:6`
- `apps/example-cms/src/ui/entry-editor-history-panel-body.tsx:94`
- `apps/example-cms/src/ui/entry-editor-layout.tsx:43`
- `apps/example-cms/src/ui/entry-editor-overlays.tsx:6`
- `apps/example-cms/src/ui/entry-editor-publication-panel-fields-support.tsx:16`
- `apps/example-cms/src/ui/entry-editor-publication-panel-fields-support.tsx:18`
- `apps/example-cms/src/ui/entry-editor-publication-panel-fields-support.tsx:20`
- `apps/example-cms/src/ui/entry-editor-publication-panel-fields-support.tsx:49`
- `apps/example-cms/src/ui/entry-editor-publication-panel-fields-support.tsx:51`
- `apps/example-cms/src/ui/entry-editor-publication-panel-fields-support.tsx:53`
- `apps/example-cms/src/ui/entry-editor-publication-panel-fields-support.tsx:85`
- `apps/example-cms/src/ui/entry-editor-publication-panel-fields-support.tsx:142`
- `apps/example-cms/src/ui/entry-editor-publication-panel-fields-support.tsx:144`
- `apps/example-cms/src/ui/entry-editor-publication-panel-fields-support.tsx:167`
- `apps/example-cms/src/ui/entry-editor-publication-panel-fields-support.tsx:169`
- `apps/example-cms/src/ui/entry-editor-publication-panel-fields-support.tsx:171`
- `apps/example-cms/src/ui/entry-editor-publication-panel-fields-support.tsx:173`
- `apps/example-cms/src/ui/entry-editor-publication-panel-fields-support.tsx:175`
- `apps/example-cms/src/ui/entry-editor-publication-panel-fields-support.tsx:234`
- `apps/example-cms/src/ui/entry-editor-publication-panel-fields-support.tsx:236`
- `apps/example-cms/src/ui/entry-editor-publication-panel-fields-support.tsx:238`
- `apps/example-cms/src/ui/entry-editor-publication-panel-sections-support.tsx:16`
- `apps/example-cms/src/ui/entry-editor-publication-panel-sections-support.tsx:18`
- `apps/example-cms/src/ui/entry-editor-publication-panel-sections-support.tsx:20`
- `apps/example-cms/src/ui/entry-editor-publication-panel-sections-support.tsx:54`
- `apps/example-cms/src/ui/entry-editor-publication-panel-sections-support.tsx:56`
- `apps/example-cms/src/ui/entry-editor-publication-panel-sections-support.tsx:58`
- `apps/example-cms/src/ui/entry-editor-publication-panel-sections-support.tsx:60`
- `apps/example-cms/src/ui/entry-editor-publication-panel-sections-support.tsx:62`
- `apps/example-cms/src/ui/entry-editor-publication-panel-sections-support.tsx:64`
- `apps/example-cms/src/ui/entry-editor-publication-panel-sections-support.tsx:66`
- `apps/example-cms/src/ui/entry-editor-publication-panel-support.tsx:11`
- `apps/example-cms/src/ui/entry-editor-publication-panel-support.tsx:13`
- `apps/example-cms/src/ui/entry-editor-publication-panel-support.tsx:15`
- `apps/example-cms/src/ui/entry-editor-publication-panel-support.tsx:17`
- `apps/example-cms/src/ui/entry-editor-publication-panel-support.tsx:19`
- `apps/example-cms/src/ui/entry-editor-publication-panel-support.tsx:21`
- `apps/example-cms/src/ui/entry-editor-publication-panel-support.tsx:23`
- `apps/example-cms/src/ui/entry-editor-rich-text-field-support.ts:20`
- `apps/example-cms/src/ui/entry-editor-rich-text-field-support.ts:22`
- `apps/example-cms/src/ui/entry-editor-rich-text-field-support.ts:24`
- `apps/example-cms/src/ui/entry-editor-rich-text-field-support.ts:26`
- `apps/example-cms/src/ui/entry-editor-rich-text-field-support.ts:67`
- `apps/example-cms/src/ui/entry-editor-rich-text-field-support.ts:69`
- `apps/example-cms/src/ui/entry-editor-rich-text-field-view.tsx:26`
- `apps/example-cms/src/ui/entry-editor-rich-text-insert-dialog-support.tsx:10`
- `apps/example-cms/src/ui/entry-editor-rich-text-insert-dialog-support.tsx:12`
- `apps/example-cms/src/ui/entry-editor-rich-text-insert-dialog.tsx:13`
- `apps/example-cms/src/ui/entry-editor-rich-text-insert-dialog.tsx:15`
- `apps/example-cms/src/ui/entry-editor-rich-text-toolbar-support.tsx:30`
- `apps/example-cms/src/ui/entry-editor-rich-text-toolbar-support.tsx:32`
- `apps/example-cms/src/ui/entry-editor-rich-text-toolbar-support.tsx:34`
- `apps/example-cms/src/ui/entry-editor-rich-text-toolbar-support.tsx:104`
- `apps/example-cms/src/ui/entry-editor-rich-text-toolbar.tsx:12`
- `apps/example-cms/src/ui/entry-editor-rich-text-toolbar.tsx:14`
- `apps/example-cms/src/ui/entry-editor-story-canvas-assets-support.tsx:8`
- `apps/example-cms/src/ui/entry-editor-story-canvas-assets-support.tsx:10`
- `apps/example-cms/src/ui/entry-editor-story-canvas-assets-support.tsx:12`
- `apps/example-cms/src/ui/entry-editor-story-canvas-assets-support.tsx:35`
- `apps/example-cms/src/ui/entry-editor-story-canvas-assets-support.tsx:37`
- `apps/example-cms/src/ui/entry-editor-story-canvas-assets-support.tsx:39`
- `apps/example-cms/src/ui/entry-editor-story-canvas-assets-support.tsx:67`
- `apps/example-cms/src/ui/entry-editor-story-canvas-assets-support.tsx:69`
- `apps/example-cms/src/ui/entry-editor-story-canvas-assets-support.tsx:90`
- `apps/example-cms/src/ui/entry-editor-story-canvas-assets-support.tsx:92`
- `apps/example-cms/src/ui/entry-editor-story-canvas-assets-support.tsx:94`
- `apps/example-cms/src/ui/entry-editor-story-canvas-assets-support.tsx:128`
- `apps/example-cms/src/ui/entry-editor-story-canvas-assets-support.tsx:130`
- `apps/example-cms/src/ui/entry-editor-story-canvas-assets-support.tsx:132`
- `apps/example-cms/src/ui/entry-editor-story-canvas-assets-support.tsx:173`
- `apps/example-cms/src/ui/entry-editor-story-canvas-fields-support.tsx:27`
- `apps/example-cms/src/ui/entry-editor-story-canvas-fields-support.tsx:29`
- `apps/example-cms/src/ui/entry-editor-story-canvas-fields-support.tsx:66`
- `apps/example-cms/src/ui/entry-editor-story-canvas-fields-support.tsx:68`
- `apps/example-cms/src/ui/entry-editor-story-canvas-fields-support.tsx:117`
- `apps/example-cms/src/ui/entry-editor-story-canvas-fields-support.tsx:119`
- `apps/example-cms/src/ui/entry-editor-story-canvas-support.tsx:16`
- `apps/example-cms/src/ui/entry-editor-story-canvas-support.tsx:18`
- `apps/example-cms/src/ui/entry-editor-story-canvas-support.tsx:20`
- `apps/example-cms/src/ui/entry-editor-story-canvas-support.tsx:37`
- `apps/example-cms/src/ui/entry-editor-story-canvas-support.tsx:39`
- `apps/example-cms/src/ui/entry-editor-story-canvas-support.tsx:41`
- `apps/example-cms/src/ui/overview-panels-support.tsx:10`
- `apps/example-cms/src/ui/rich-text-editor/transactions-editor-adapter-render.ts:68`
- `apps/example-cms/src/ui/rich-text-editor/transactions-editor-adapter-render.ts:70`
- `apps/example-cms/src/ui/rich-text-editor/transactions-editor-adapter-selection.ts:10`
- `apps/example-cms/src/ui/rich-text-editor/transactions-list-command-handlers.ts:94`
- `apps/example-cms/src/ui/rich-text-editor/transactions-list-command-handlers.ts:114`
- `apps/example-cms/src/ui/rich-text-editor/transactions-list-command-handlers.ts:138`
- `apps/example-cms/src/ui/rich-text-editor/transactions-list-command-handlers.ts:204`
- `apps/example-cms/src/ui/rich-text-editor/transactions-mutations.ts:80`
- `apps/example-cms/src/ui/rich-text-editor/transactions-mutations.ts:120`
- `apps/example-cms/src/ui/rich-text-editor/transactions-selection.ts:8`
- `apps/example-cms/src/ui/rich-text-editor/transactions-selection.ts:128`
- `apps/example-cms/src/ui/rich-text-editor/transactions-support.ts:87`

### TypeScript · `typescript/no-unsafe-type-assertion`

#### EH-140: closest runs on the runtime Element resolved from the selection node.

**Locations:**

- `apps/example-cms/src/ui/rich-text-editor/transactions-editor-adapter-support.ts:151`

#### EH-141: fetch requires AbortSignal; generated clients pass the runtime signal.

**Locations:**

- `apps/example-cms/src/generated/headless-openapi-client-runtime-transport.ts:65`
- `apps/example-cms/src/generated/management-openapi-client-runtime-transport.ts:65`
- `apps/public-blog/src/generated/headless-openapi-client-runtime-transport.ts:65`
- `scripts/openapi-client-generator/runtime-template.ts:155`

#### EH-142: list item filtering preserves list-item node shapes within the editor document.

**Locations:**

- `apps/example-cms/src/ui/rich-text-editor/transactions-list-command-handlers.ts:66`

#### EH-143: list replacement preserves list node shape after item removal.

**Locations:**

- `apps/example-cms/src/ui/rich-text-editor/transactions-list-command-handlers.ts:62`

#### EH-144: MutationObserver.observe requires Node; the editable host is a runtime HTMLElement.

**Locations:**

- `apps/example-cms/src/ui/rich-text-editor/browser-adapter.ts:96`

#### EH-145: OpenAPI schema objects are validated as non-null objects before use.

**Locations:**

- `scripts/openapi-client-generator/component-schema-names.ts:12`

#### EH-146: paragraph children inherit inline nodes from the lifted block root.

**Locations:**

- `apps/example-cms/src/ui/rich-text-editor/transactions-list-command-handlers.ts:226`

#### EH-147: ReadonlyEditableHost is a Pick view of the editable div passed at runtime.

**Locations:**

- `apps/example-cms/src/ui/rich-text-editor/transactions-editor-adapter-support.ts:88`

#### EH-148: restoreSelectionRange reads selection anchors from the runtime editable host.

**Locations:**

- `apps/example-cms/src/ui/rich-text-editor/browser-adapter.ts:101`

#### EH-149: RichText.toJson returns a JSON-compatible object validated by the CMS schema boundary.

**Locations:**

- `apps/example-cms/src/domain/seed.ts:26`

#### EH-150: synchronizeSelectionState queries the runtime editable host for the current DOM selection.

**Locations:**

- `apps/example-cms/src/ui/rich-text-editor/browser-adapter.ts:126`

#### EH-151: Web APIs require AbortSignal; transport callers always pass the real signal.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-readonly-types.ts:23`

#### EH-152: Web APIs require Request; transport callers always pass the real request.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-readonly-types.ts:28`

#### EH-316: allowlist JSON is versioned repository fixture data validated at acceptance runtime.

**Locations:**

- `acceptance/accessibility/axe-webview-support.ts:29`

### TypeScript · `typescript/prefer-readonly-parameter-types`

#### EH-153: action log must remain mutable for assertions.

**Locations:**

- `packages/nearly-headless-cms/test/contract/authorization-expansion-support.ts:59`
- `packages/nearly-headless-cms/test/contract/authorization-expansion.test.ts:7`
- `packages/nearly-headless-cms/test/contract/authorization-expansion.test.ts:37`
- `packages/nearly-headless-cms/test/contract/authorization-expansion.test.ts:62`
- `packages/nearly-headless-cms/test/contract/authorization-expansion.test.ts:97`

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

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-support.ts:263`

#### EH-159: CmsError tagged unions are inspected via Schema.is without mutation.

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

#### EH-160: comment submission bodies are validated as loosely typed JSON records.

**Locations:**

- `apps/example-cms/src/delivery-comment-submission-support.ts:181`

#### EH-161: conflict resolution callbacks receive mutable draft value maps.

**Locations:**

- `apps/example-cms/src/ui/entry-editor-conflict-panel.tsx:16`
- `apps/example-cms/src/ui/entry-editor-conflict-panel.tsx:67`

#### EH-162: create results use CMS mutation response union shapes.

**Locations:**

- `apps/example-cms/src/ui/content-list-support.ts:56`

#### EH-163: deniedAction.current is mutated to simulate authorization denial.

**Locations:**

- `packages/nearly-headless-cms/test/contract/authorization-expansion.test.ts:9`

#### EH-164: discovery routes read configured operations without mutation.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-preflight-support.ts:68`

#### EH-165: DOM selection nodes are inspected without retaining references.

**Locations:**

- `apps/example-cms/src/ui/rich-text-editor/transactions-editor-adapter-support.ts:130`
- `apps/example-cms/src/ui/rich-text-editor/transactions-editor-adapter-support.ts:145`

#### EH-166: DOM spans are mutated while applying rich-text marks.

**Locations:**

- `apps/example-cms/src/ui/rich-text-editor/transactions-editor-adapter-render.ts:16`

#### EH-167: DOM spans are mutated while assigning editor selection indices.

**Locations:**

- `apps/example-cms/src/ui/rich-text-editor/transactions-editor-adapter-render.ts:30`

#### EH-168: DOM text spans are read while mapping native selection offsets.

**Locations:**

- `apps/example-cms/src/ui/rich-text-editor/transactions-editor-adapter-support.ts:159`

#### EH-169: editable hosts are mutated while restoring native selection ranges.

**Locations:**

- `apps/example-cms/src/ui/rich-text-editor/transactions-editor-adapter-selection.ts:51`

#### EH-170: editable hosts are queried for live native selection state.

**Locations:**

- `apps/example-cms/src/ui/rich-text-editor/transactions-editor-adapter-selection.ts:42`

#### EH-171: editable hosts are queried while synchronizing editor selection state.

**Locations:**

- `apps/example-cms/src/ui/rich-text-editor/transactions-editor-adapter-selection.ts:85`

#### EH-172: Effect programs are executed by runOperationInterruptibly without mutation.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-handler-support.ts:137`

#### EH-173: Effect programs are executed by runPromise without mutation.

**Locations:**

- `packages/nearly-headless-cms/test/contract/authorization-expansion-support.ts:57`
- `packages/nearly-headless-cms/test/filesystem/filesystem-commit-boundary-child-scenarios.ts:19`
- `packages/nearly-headless-cms/test/filesystem/filesystem-commit-boundary-scenarios.ts:17`
- `packages/nearly-headless-cms/test/filesystem/filesystem-concurrency-fault-scenarios.ts:37`
- `packages/nearly-headless-cms/test/filesystem/filesystem-fault-injection-manifest-scenarios.ts:45`
- `packages/nearly-headless-cms/test/filesystem/filesystem-fault-injection-scenarios.ts:23`
- `packages/nearly-headless-cms/test/filesystem/filesystem-fault-injection-scenarios.ts:31`
- `packages/nearly-headless-cms/test/filesystem/filesystem-persistence-corruption-scenarios.ts:29`
- `packages/nearly-headless-cms/test/filesystem/filesystem-persistence-scenarios.ts:203`
- `packages/nearly-headless-cms/test/filesystem/filesystem-persistence-writer-scenarios.ts:20`
- `packages/nearly-headless-cms/test/filesystem/filesystem-persistence-writer-scenarios.ts:30`
- `packages/nearly-headless-cms/test/integration/asset-http-delivery.test.ts:52`
- `packages/nearly-headless-cms/test/integration/asset-http-delivery.test.ts:60`
- `packages/nearly-headless-cms/test/integration/asset-http-delivery.test.ts:79`
- `packages/nearly-headless-cms/test/integration/asset-http-delivery.test.ts:106`
- `packages/nearly-headless-cms/test/integration/cms-service.test.ts:38`
- `packages/nearly-headless-cms/test/integration/definition-lifecycle.test.ts:16`
- `packages/nearly-headless-cms/test/integration/definition-lifecycle.test.ts:22`
- `packages/nearly-headless-cms/test/integration/definition-lifecycle.test.ts:28`
- `packages/nearly-headless-cms/test/integration/definition-migration-journey-scenarios.ts:67`
- `packages/nearly-headless-cms/test/integration/entry-history.test.ts:11`

#### EH-174: Effect programs are executed, not mutated, by runPromise.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-response.ts:220`

#### EH-175: Effect programs are mapped without mutation.

**Locations:**

- `apps/example-cms/src/generated/management-client.ts:258`

#### EH-177: handler Options includes requestIdentifier callbacks.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-handler.ts:135`

#### EH-178: ingest content may be a Uint8Array or Effect Stream consumed during commit.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-support.ts:74`
- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-support.ts:134`

#### EH-179: Layer values are provided to runPromise without mutation.

**Locations:**

- `packages/nearly-headless-cms/test/filesystem/filesystem-commit-boundary-child-scenarios.ts:17`
- `packages/nearly-headless-cms/test/filesystem/filesystem-commit-boundary-scenarios.ts:15`
- `packages/nearly-headless-cms/test/filesystem/filesystem-concurrency-fault-scenarios.ts:35`
- `packages/nearly-headless-cms/test/filesystem/filesystem-fault-injection-manifest-scenarios.ts:43`
- `packages/nearly-headless-cms/test/filesystem/filesystem-fault-injection-scenarios.ts:21`
- `packages/nearly-headless-cms/test/filesystem/filesystem-fault-injection-scenarios.ts:29`
- `packages/nearly-headless-cms/test/filesystem/filesystem-persistence-corruption-scenarios.ts:27`
- `packages/nearly-headless-cms/test/filesystem/filesystem-persistence-scenarios.ts:201`
- `packages/nearly-headless-cms/test/filesystem/filesystem-persistence-writer-scenarios.ts:18`
- `packages/nearly-headless-cms/test/filesystem/filesystem-persistence-writer-scenarios.ts:28`
- `packages/nearly-headless-cms/test/integration/definition-migration-journey-scenarios.ts:65`

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

- `packages/nearly-headless-cms/src/cms-entry-references-support.ts:66`

#### EH-185: mutable issues and result out-params are bundled in input interface.

**Locations:**

- `packages/nearly-headless-cms/src/content-definition-entry-validation.ts:107`
- `packages/nearly-headless-cms/src/content-definition-entry-validation.ts:134`
- `packages/nearly-headless-cms/src/content-definition-entry-validation.ts:161`
- `packages/nearly-headless-cms/src/content-definition-entry-validation.ts:172`
- `packages/nearly-headless-cms/src/content-definition-entry-validation.ts:187`
- `packages/nearly-headless-cms/src/content-definition-entry-validation.ts:201`

#### EH-186: mutable issues out-param is bundled in input interface.

**Locations:**

- `packages/nearly-headless-cms/src/content-definition-entry-validation.ts:21`
- `packages/nearly-headless-cms/src/content-definition-entry-validation.ts:39`

#### EH-187: mutable listResult out-param is bundled in input interface.

**Locations:**

- `packages/nearly-headless-cms/src/content-definition-entry-validation.ts:74`
- `packages/nearly-headless-cms/src/content-definition-entry-validation.ts:99`

#### EH-188: mutable out-params are bundled in input interface.

**Locations:**

- `packages/nearly-headless-cms/src/cms-entry-references-support.ts:96`
- `packages/nearly-headless-cms/src/cms-entry-references-support.ts:108`
- `packages/nearly-headless-cms/src/cms-entry-references-support.ts:122`
- `packages/nearly-headless-cms/src/cms-entry-references-support.ts:136`

#### EH-189: mutable projected out-param is bundled in input interface.

**Locations:**

- `packages/nearly-headless-cms/src/entry-query-projection.ts:21`

#### EH-190: mutable relationships out-param is bundled in input interface.

**Locations:**

- `packages/nearly-headless-cms/src/cms-entry-references-support.ts:76`

#### EH-191: mutable values out-param is bundled in input interface.

**Locations:**

- `packages/nearly-headless-cms/src/cms-entry-expansion-field-group-support.ts:44`
- `packages/nearly-headless-cms/src/cms-entry-expansion-field-group-support.ts:79`
- `packages/nearly-headless-cms/src/cms-entry-expansion-relationship-support.ts:113`
- `packages/nearly-headless-cms/src/cms-entry-references-path-support.ts:37`

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
- `packages/nearly-headless-cms/src/http/open-api.ts:59`

#### EH-195: OpenAPI routes read configured operations without mutation.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-preflight-support.ts:94`
- `packages/nearly-headless-cms/src/http/http-transport-preflight-support.ts:96`

#### EH-196: OperationFetchRequest carries optional readonly abort signal bridge fields.

**Locations:**

- `apps/example-cms/src/generated/headless-openapi-client-runtime-transport.ts:46`
- `apps/example-cms/src/generated/management-openapi-client-runtime-transport.ts:46`
- `apps/public-blog/src/generated/headless-openapi-client-runtime-transport.ts:46`
- `scripts/openapi-client-generator/runtime-template.ts:139`

#### EH-197: OperationSchema values include Effect Schema classes that are not deeply readonly.

**Locations:**

- `apps/example-cms/src/delivery-support.ts:160`

#### EH-198: path parameter schemas include Effect Schema classes that are not deeply readonly.

**Locations:**

- `apps/example-cms/src/delivery-support.ts:162`

#### EH-199: React callbacks receive mutable draft value maps from the editor.

**Locations:**

- `apps/example-cms/src/ui/entry-editor-controller-mutations.ts:25`
- `apps/example-cms/src/ui/entry-editor-controller-mutations.ts:27`
- `apps/example-cms/src/ui/entry-editor-mutations.ts:61`
- `apps/example-cms/src/ui/entry-editor-mutations.ts:129`

#### EH-200: React Query mutation and query objects expose mutable status while rendering history.

**Locations:**

- `apps/example-cms/src/ui/entry-editor-history-panel-body.tsx:53`

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

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-support.ts:158`

#### EH-206: stored asset bytes are read without mutation when serving range requests.

**Locations:**

- `apps/example-cms/src/delivery-public-asset-response-support.ts:58`

#### EH-207: SynchronizedRef state is mutated while persisting ingested assets.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-services.ts:218`

#### EH-208: Uint8Array chunks are returned without mutation.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-response.ts:163`

#### EH-239: document line buffer is mutated while rendering the registry.

**Locations:**

- `scripts/escape-hatches-render-support.ts:29`
- `scripts/escape-hatches-render-support.ts:75`

#### EH-276: drain polling reads shared active-request counters without mutating them.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-lifecycle-support.ts:52`

#### EH-277: HttpTransport handler mirrors the Web Request callback contract.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-lifecycle-support.ts:92`
- `packages/nearly-headless-cms/test/integration/asset-http-delivery.test.ts:47`

#### EH-278: Layer factory accepts optional builder configuration without mutation.

**Locations:**

- `packages/nearly-headless-cms/src/bun/http/bun-http-transport.ts:19`

#### EH-279: RequestInit is passed directly into the Web Request constructor.

**Locations:**

- `packages/nearly-headless-cms/test/integration/asset-http-delivery.test.ts:55`

#### EH-280: shutdown mutates shared lifecycle counters and abort controllers.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-lifecycle-support.ts:68`

#### EH-281: wrapped handlers mutate shared active-request counters.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-lifecycle-support.ts:94`

### Effect · `effecttsgo/abort-controller-in-effect`

#### EH-243: transport shutdown keeps one shared AbortController for in-flight Web requests.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-lifecycle-support.ts:76`

### Effect · `effecttsgo/async-function`

#### EH-002: Asset staging finalization coordinates Bun writer flush and fsync boundaries.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-support.ts:161`

#### EH-003: Atomic persistence coordinates Bun and node filesystem promises.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-support.ts:260`

#### EH-004: baseline bytes are read through Promise-based Bun filesystem APIs.

**Locations:**

- `acceptance/visual/responsive-baselines.test.ts:33`

#### EH-005: Bun filesystem handles expose Promise-based synchronization boundaries.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-support.ts:176`

#### EH-006: Bun lifecycle hook performs async cleanup.

**Locations:**

- `acceptance/journeys/complete-system-journeys.test.ts:44`
- `apps/example-cms/test/integration/destructive-workflows.test.ts:27`
- `apps/example-cms/test/integration/headless-api.test.ts:30`
- `apps/example-cms/test/integration/public-visibility.test.ts:29`
- `apps/example-cms/test/integration/publication-validation.test.ts:29`

#### EH-007: Bun lifecycle hook performs async system setup.

**Locations:**

- `acceptance/journeys/complete-system-journeys.test.ts:34`
- `apps/example-cms/test/integration/destructive-workflows.test.ts:22`
- `apps/example-cms/test/integration/headless-api.test.ts:25`
- `apps/example-cms/test/integration/public-visibility.test.ts:24`
- `apps/example-cms/test/integration/publication-validation.test.ts:22`

#### EH-008: Bun WebView evaluation and sleep are Promise-based platform lifecycle operations.

**Locations:**

- `acceptance/visual/responsive-baselines.test.ts:59`
- `acceptance/webview/journey.test.ts:180`
- `acceptance/webview/journey.test.ts:199`
- `acceptance/webview/qualification.test.ts:44`

#### EH-009: Bun's test runner requires a Promise-returning lifecycle callback.

**Locations:**

- `acceptance/accessibility/axe-webview.test.ts:61`
- `acceptance/accessibility/axe-webview.test.ts:69`
- `acceptance/visual/responsive-baselines.test.ts:85`
- `acceptance/webview/journey.test.ts:223`
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

- `scripts/compatibility-matrix.ts:17`
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

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-support.ts:124`

#### EH-019: entry creation sequences dependent requests.

**Locations:**

- `apps/example-cms/src/ui/content-list-mutations.ts:19`

#### EH-020: escape hatch registry CLI uses async filesystem IO.

**Locations:**

- `scripts/escape-hatches-parse-support.ts:53`
- `scripts/escape-hatches-parse-support.ts:169`
- `scripts/escape-hatches-registry-support.ts:12`
- `scripts/escape-hatches-registry-support.ts:73`
- `scripts/escape-hatches-registry-support.ts:169`
- `scripts/escape-hatches-support.ts:7`
- `scripts/escape-hatches-support.ts:35`

#### EH-021: FileHandle.write is Promise-based and must remain ordered.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-request-parsing-support.ts:267`

#### EH-022: fingerprint validation awaits interruptible Effect execution.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-handler-support.ts:118`

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

- `apps/example-cms/src/generated/headless-openapi-client-runtime-transport.ts:99`
- `apps/example-cms/src/generated/headless-openapi-client-runtime-transport.ts:148`
- `apps/example-cms/src/generated/headless-openapi-client-runtime-transport.ts:186`
- `apps/example-cms/src/generated/management-openapi-client-runtime-transport.ts:129`
- `apps/example-cms/src/generated/management-openapi-client-runtime-transport.ts:178`
- `apps/example-cms/src/generated/management-openapi-client-runtime-transport.ts:216`
- `apps/public-blog/src/generated/headless-openapi-client-runtime-transport.ts:99`
- `apps/public-blog/src/generated/headless-openapi-client-runtime-transport.ts:148`
- `apps/public-blog/src/generated/headless-openapi-client-runtime-transport.ts:186`
- `scripts/openapi-client-generator/runtime-template.ts:2`
- `scripts/openapi-client-generator/runtime-template.ts:51`
- `scripts/openapi-client-generator/runtime-template.ts:86`

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

#### EH-033: interruptible outcomes are awaited before routing continues.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-handler-support.ts:135`

#### EH-034: journey assertions compose awaited WebView navigation and evaluation.

**Locations:**

- `acceptance/webview/journey.test.ts:23`
- `acceptance/webview/journey.test.ts:33`
- `acceptance/webview/journey.test.ts:38`
- `acceptance/webview/journey.test.ts:68`
- `acceptance/webview/journey.test.ts:93`

#### EH-035: journey orchestration composes native WebView Promise operations.

**Locations:**

- `acceptance/webview/journey.test.ts:127`
- `acceptance/webview/journey.test.ts:139`
- `acceptance/webview/journey.test.ts:160`

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

- `scripts/check-architecture.ts:194`

#### EH-042: parallel portability scans use async file reads.

**Locations:**

- `scripts/check-architecture.ts:211`

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
- `apps/example-cms/src/ui/entry-editor-history-panel-body.tsx:182`

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

- `packages/nearly-headless-cms/src/http/http-transport-handler.ts:142`

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

- `acceptance/visual/responsive-baselines.test.ts:12`

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

- `packages/nearly-headless-cms/src/http/http-transport-response.ts:206`

#### EH-066: Web Request.arrayBuffer is Promise-based and this helper is not a pipeable Effect API.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-request-parsing.ts:96`

#### EH-067: Writer lock creation is a sequential Bun filesystem boundary.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-io.ts:46`
- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-io.ts:225`

#### EH-227: escape hatch registry helpers are intentionally direct-call only.

**Locations:**

- `scripts/escape-hatches-registry-support.ts:211`

#### EH-244: lifecycle wrapper is a Web-standard Promise<Response> callback.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-lifecycle-support.ts:97`

#### EH-302: slow consumer reads intentionally await Bun.sleep between stream chunks; readNextChunk closes over reader.

**Locations:**

- `packages/nearly-headless-cms/test/integration/http-socket-integration-backpressure-scenarios.ts:55`

#### EH-311: axe acceptance scans compose awaited WebView navigation and evaluation.

**Locations:**

- `acceptance/accessibility/axe-webview.test.ts:38`
- `acceptance/accessibility/axe-webview.test.ts:76`
- `acceptance/accessibility/axe-webview.test.ts:115`

#### EH-312: WebView readiness polling composes awaited evaluation and sleep.

**Locations:**

- `acceptance/accessibility/axe-webview.test.ts:138`

#### EH-318: visual baseline preparation composes awaited WebView navigation and evaluation.

**Locations:**

- `acceptance/visual/visual-baseline-scenarios.ts:75`
- `acceptance/visual/visual-baseline-scenarios.ts:119`
- `acceptance/visual/visual-baseline-scenarios.ts:172`
- `acceptance/visual/visual-baseline-scenarios.ts:181`
- `acceptance/visual/visual-baseline-scenarios.ts:185`
- `acceptance/visual/visual-baseline-scenarios.ts:189`
- `acceptance/visual/visual-baseline-scenarios.ts:194`
- `acceptance/visual/visual-baseline-scenarios.ts:199`
- `acceptance/visual/visual-baseline-scenarios.ts:203`

#### EH-319: visual baseline setup queries the live Example CMS management API.

**Locations:**

- `acceptance/visual/visual-baseline-management-support.ts:18`

#### EH-320: visual baseline setup reads the live Example CMS management API.

**Locations:**

- `acceptance/visual/visual-baseline-management-support.ts:43`

#### EH-321: visual baseline setup writes through the live Example CMS management API.

**Locations:**

- `acceptance/visual/visual-baseline-management-support.ts:83`

#### EH-326: interactive visual scenarios reset mutated Example CMS fixture entries.

**Locations:**

- `acceptance/visual/visual-baseline-management-support.ts:106`

#### EH-328: visual baseline polling composes sequential WebView evaluation and sleep.

**Locations:**

- `acceptance/visual/visual-baseline-scenarios.ts:50`

#### EH-334: visual baseline setup prepares invalid draft publication state through the management API.

**Locations:**

- `acceptance/visual/visual-baseline-scenarios.ts:16`

#### EH-339: editor navigation depends on waitUntilExpression despite alphabetical ordering.

**Locations:**

- `acceptance/visual/visual-baseline-scenarios.ts:63`

#### EH-344: conflict preparation follows controlled input setup despite alphabetical ordering.

**Locations:**

- `acceptance/visual/visual-baseline-scenarios.ts:148`

#### EH-346: controlled input updates precede conflict preparation despite alphabetical ordering.

**Locations:**

- `acceptance/visual/visual-baseline-scenarios.ts:128`

#### EH-348: journey orchestration follows helper dependency order despite alphabetical ordering.

**Locations:**

- `acceptance/webview/journey.test.ts:150`

### Effect · `effecttsgo/crypto-random-uuid`

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

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-support.ts:268`

#### EH-072: staging paths are computed before the Effect stream starts and must remain synchronous.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-support.ts:83`

#### EH-073: the management client accepts a synchronous idempotency key.

**Locations:**

- `apps/example-cms/src/ui/assets-page-mutations-support.ts:10`
- `apps/example-cms/src/ui/assets-page-mutations-support.ts:24`

### Effect · `effecttsgo/extends-native-error`

#### EH-074: This transport-only error is converted to a CmsError before entering an Effect failure channel.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-request-failure.ts:1`

### Effect · `effecttsgo/global-console`

#### EH-075: acceptance completion is intentionally emitted to CLI stdout.

**Locations:**

- `scripts/run-acceptance.ts:106`

#### EH-076: acceptance progress is intentionally emitted to CLI stdout.

**Locations:**

- `scripts/run-acceptance.ts:27`

#### EH-077: escape hatch registry CLI reports to stdout and stderr.

**Locations:**

- `scripts/escape-hatches-support.ts:13`
- `scripts/escape-hatches-support.ts:21`
- `scripts/escape-hatches-support.ts:29`
- `scripts/escape-hatches-support.ts:51`

#### EH-078: this script's contract is machine-readable CLI stdout.

**Locations:**

- `scripts/check-architecture.ts:241`

### Effect · `effecttsgo/global-fetch`

#### EH-079: Browser mutation boundary is owned by the UI query client.

**Locations:**

- `apps/example-cms/src/ui/overview-rebuild-support.ts:7`

#### EH-080: CLI acceptance polling intentionally uses the platform fetch boundary.

**Locations:**

- `scripts/run-acceptance.ts:50`

#### EH-235: generated clients intentionally use the platform fetch boundary so callers can supply the browser or server runtime.

**Locations:**

- `apps/example-cms/src/generated/headless-openapi-client-runtime-transport.ts:49`
- `apps/example-cms/src/generated/management-openapi-client-runtime-transport.ts:49`
- `apps/public-blog/src/generated/headless-openapi-client-runtime-transport.ts:49`
- `scripts/openapi-client-generator/runtime-template.ts:142`

#### EH-245: integration test exercises an in-flight request during shutdown drain.

**Locations:**

- `packages/nearly-headless-cms/test/integration/http-socket-integration-shutdown-scenarios.ts:33`

#### EH-246: integration test exercises rejection during shutdown drain.

**Locations:**

- `packages/nearly-headless-cms/test/integration/http-socket-integration-shutdown-scenarios.ts:46`

#### EH-247: integration test exercises the live HTTP listener through the platform fetch boundary.

**Locations:**

- `packages/nearly-headless-cms/test/integration/http-socket-integration-scenarios.ts:32`

#### EH-248: integration test starts a request that outlives the drain window.

**Locations:**

- `packages/nearly-headless-cms/test/integration/http-socket-integration-forced-shutdown-scenarios.ts:22`

#### EH-282: integration test exercises multipart upload through the live HTTP listener.

**Locations:**

- `packages/nearly-headless-cms/test/integration/http-socket-integration-multipart-scenarios.ts:54`

#### EH-288: integration test aborts an in-flight request against the live HTTP listener.

**Locations:**

- `packages/nearly-headless-cms/test/integration/http-socket-integration-disconnect-scenarios.ts:39`

#### EH-289: integration test exercises request timeout through the live HTTP listener.

**Locations:**

- `packages/nearly-headless-cms/test/integration/http-socket-integration-timeout-scenarios.ts:36`

#### EH-303: integration test exercises JSON body limits through the live HTTP listener.

**Locations:**

- `packages/nearly-headless-cms/test/integration/http-socket-integration-body-limit-scenarios.ts:42`

#### EH-304: integration test streams an Asset download through the live HTTP listener.

**Locations:**

- `packages/nearly-headless-cms/test/integration/http-socket-integration-backpressure-scenarios.ts:89`

#### EH-305: integration test uploads an Asset through the live HTTP listener.

**Locations:**

- `packages/nearly-headless-cms/test/integration/http-socket-integration-backpressure-scenarios.ts:74`

#### EH-309: integration test uploads a paced multipart Asset body through the live HTTP listener.

**Locations:**

- `packages/nearly-headless-cms/test/integration/http-socket-integration-slow-producer-scenarios.ts:68`

#### EH-322: visual baseline setup queries the live Example CMS management API.

**Locations:**

- `acceptance/visual/visual-baseline-management-support.ts:23`

#### EH-323: visual baseline setup reads the live Example CMS management API.

**Locations:**

- `acceptance/visual/visual-baseline-management-support.ts:48`

#### EH-324: visual baseline setup writes through the live Example CMS management API.

**Locations:**

- `acceptance/visual/visual-baseline-management-support.ts:90`

### Effect · `effecttsgo/global-fetch-in-effect`

#### EH-236: generated clients intentionally use the platform fetch boundary so callers can supply the browser or server runtime.

**Locations:**

- `apps/example-cms/src/generated/headless-openapi-client-runtime-transport.ts:49`
- `apps/example-cms/src/generated/management-openapi-client-runtime-transport.ts:49`
- `apps/public-blog/src/generated/headless-openapi-client-runtime-transport.ts:49`
- `scripts/openapi-client-generator/runtime-template.ts:142`

### Effect · `effecttsgo/global-timers`

#### EH-249: pre-shutdown delay starts drain while the slow request remains active.

**Locations:**

- `packages/nearly-headless-cms/test/integration/http-socket-integration-shutdown-scenarios.ts:37`

#### EH-250: slow handler delay mirrors a peer that keeps the connection open.

**Locations:**

- `packages/nearly-headless-cms/test/integration/http-socket-integration-shutdown-scenarios.ts:19`

### Effect · `effecttsgo/missing-pipeable-signature`

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
- `packages/nearly-headless-cms/src/definition-migration.ts:26`
- `packages/nearly-headless-cms/src/definition-migration.ts:62`
- `packages/nearly-headless-cms/src/rich-text.ts:62`
- `packages/nearly-headless-cms/src/rich-text.ts:70`
- `packages/nearly-headless-cms/src/rich-text.ts:75`

#### EH-087: editor transaction API is intentionally a direct two-argument operation.

**Locations:**

- `apps/example-cms/src/ui/rich-text-editor/transactions-dispatch.ts:63`

#### EH-088: JSON field helper is intentionally a direct two-argument operation.

**Locations:**

- `apps/example-cms/test/integration/headless-api-support.ts:36`

#### EH-089: local schema adapter is intentionally direct-call only.

**Locations:**

- `apps/example-cms/src/delivery-support.ts:158`

#### EH-090: multipart parsing is Promise-based and this helper is not a pipeable Effect API.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-request-parsing-support.ts:213`
- `packages/nearly-headless-cms/src/http/http-transport-request-parsing.ts:167`

#### EH-091: public serialize helper is not a pipeable Effect API.

**Locations:**

- `packages/nearly-headless-cms/src/rich-text.ts:68`

#### EH-092: Rich Text helpers are not pipeable Effect APIs.

**Locations:**

- `packages/nearly-headless-cms/src/rich-text.ts:57`

#### EH-093: route dispatch is a plain async helper, not a pipeable Effect API.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-route-dispatch.ts:7`

#### EH-094: test helper is not a pipeable Effect API.

**Locations:**

- `packages/nearly-headless-cms/test/contract/authorization-expansion-support.ts:55`

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
- `apps/example-cms/src/ui/main-labels.ts:182`

#### EH-098: UI value helper is intentionally a direct two-argument operation.

**Locations:**

- `apps/example-cms/src/ui/main-entry-support.ts:89`

#### EH-099: Web handler timeout wrapper is not a pipeable Effect API.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-request-timeout-support.ts:87`

#### EH-100: Web Request.arrayBuffer is Promise-based and this helper is not a pipeable Effect API.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-request-parsing.ts:96`

#### EH-228: escape hatch registry helpers are intentionally direct-call only.

**Locations:**

- `scripts/escape-hatches-registry-support.ts:211`

#### EH-329: interactive visual scenarios reset mutated Example CMS fixture entries.

**Locations:**

- `acceptance/visual/visual-baseline-management-support.ts:106`

#### EH-330: visual baseline setup queries the live Example CMS management API.

**Locations:**

- `acceptance/visual/visual-baseline-management-support.ts:18`

#### EH-331: visual baseline setup reads the live Example CMS management API.

**Locations:**

- `acceptance/visual/visual-baseline-management-support.ts:43`

#### EH-332: visual baseline setup writes through the live Example CMS management API.

**Locations:**

- `acceptance/visual/visual-baseline-management-support.ts:83`

### Effect · `effecttsgo/new-promise`

#### EH-251: hanging handler keeps the socket open until forced shutdown.

**Locations:**

- `packages/nearly-headless-cms/test/integration/http-socket-integration-forced-shutdown-scenarios.ts:14`

#### EH-252: shutdown timing is coordinated through Promise composition in the socket test.

**Locations:**

- `packages/nearly-headless-cms/test/integration/http-socket-integration-shutdown-scenarios.ts:35`

#### EH-253: slow handler simulates an in-flight socket request outside Effect.

**Locations:**

- `packages/nearly-headless-cms/test/integration/http-socket-integration-shutdown-scenarios.ts:17`

### Effect · `effecttsgo/node-builtin-import`

#### EH-101: Bun does not provide a path manipulation API; these operations are platform-neutral string handling.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-io.ts:19`
- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-root-imports.ts:14`
- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-root-load-imports.ts:4`
- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-services-imports.ts:29`
- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-support-imports.ts:17`

#### EH-102: Standalone CLI resolves repository paths before any Effect application exists.

**Locations:**

- `scripts/check-architecture.ts:2`
- `scripts/compatibility-matrix.ts:1`
- `scripts/escape-hatches-parse-support.ts:2`
- `scripts/record-release-evidence.ts:1`
- `scripts/release.ts:1`
- `scripts/run-acceptance.ts:2`

#### EH-103: Temporary upload staging requires node fs primitives unavailable in the HTTP FileSystem abstraction.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-request-parsing-support.ts:11`
- `packages/nearly-headless-cms/src/http/http-transport-request-parsing-support.ts:15`

#### EH-104: Temporary upload staging requires node os primitives unavailable in the HTTP FileSystem abstraction.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-request-parsing-support.ts:19`

#### EH-105: Temporary upload staging requires node path primitives unavailable in the HTTP FileSystem abstraction.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-request-parsing-support.ts:17`

#### EH-106: This Bun adapter needs durable fsync/open and directory primitives unavailable in Effect's portable FileSystem layer.

**Locations:**

- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-io.ts:14`
- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-root-imports.ts:12`
- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-lock-root-load-imports.ts:6`
- `packages/nearly-headless-cms/src/bun/filesystem/bun-filesystem-persistence-support-imports.ts:15`

#### EH-210: Baseline paths are test-runner setup paths; there is no Effect runtime involved in this Bun test.

**Locations:**

- `acceptance/visual/responsive-baselines.test.ts:3`

#### EH-211: Path joining is host-path setup for this filesystem integration test, outside the Effect service graph.

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
- `packages/nearly-headless-cms/test/filesystem/filesystem-persistence-corruption-scenarios.ts:6`
- `packages/nearly-headless-cms/test/filesystem/filesystem-persistence-scenarios.ts:35`
- `packages/nearly-headless-cms/test/filesystem/filesystem-persistence-writer-scenarios.ts:10`

#### EH-212: The test exercises the Bun filesystem adapter's on-disk behavior; these helpers have no Bun equivalent.

**Locations:**

- `packages/nearly-headless-cms/test/filesystem/filesystem-commit-boundary-child-scenarios-imports.ts:9`
- `packages/nearly-headless-cms/test/filesystem/filesystem-commit-boundary-scenarios-imports.ts:5`
- `packages/nearly-headless-cms/test/filesystem/filesystem-concurrency-fault-scenarios-imports.ts:5`
- `packages/nearly-headless-cms/test/filesystem/filesystem-fault-injection-manifest-scenarios-imports.ts:5`
- `packages/nearly-headless-cms/test/filesystem/filesystem-fault-injection-scenarios-imports.ts:5`
- `packages/nearly-headless-cms/test/filesystem/filesystem-persistence-corruption-scenarios.ts:8`
- `packages/nearly-headless-cms/test/filesystem/filesystem-persistence-scenarios.ts:32`
- `packages/nearly-headless-cms/test/filesystem/filesystem-persistence-writer-scenarios.ts:12`

#### EH-283: Journey setup creates an isolated filesystem root before the CMS layer starts.

**Locations:**

- `acceptance/journeys/complete-system-journeys-scenarios-imports.ts:12`
- `packages/nearly-headless-cms/test/integration/definition-migration-journey-scenarios-imports.ts:17`

#### EH-284: Path joining is host-path setup for this acceptance journey, outside the Effect service graph.

**Locations:**

- `acceptance/journeys/complete-system-journeys-scenarios-imports.ts:14`
- `packages/nearly-headless-cms/test/integration/definition-migration-journey-scenarios-imports.ts:19`

#### EH-313: Accessibility test setup resolves axe-core from node_modules before any Effect application exists.

**Locations:**

- `acceptance/accessibility/axe-webview-support.ts:3`

#### EH-317: fileURLToPath converts Bun module resolution URLs into filesystem paths for axe-core serving.

**Locations:**

- `acceptance/accessibility/axe-webview-support.ts:1`

### Effect · `effecttsgo/prefer-schema-over-json`

#### EH-107: request bodies are OpenAPI-generated unknown shapes and must be serialized using the browser JSON boundary.

**Locations:**

- `apps/example-cms/src/generated/headless-openapi-client-runtime-transport-request-support.ts:37`
- `apps/example-cms/src/generated/management-openapi-client-runtime-transport-request-support.ts:37`
- `apps/public-blog/src/generated/headless-openapi-client-runtime-transport-request-support.ts:37`
- `scripts/openapi-client-generator/runtime-template.ts:229`

### Effect · `effecttsgo/run-effect-inside-effect`

#### EH-108: bridge the abort callback into Promise.race.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-request-timeout-support.ts:84`

#### EH-109: interrupt the owned timer fiber during Web handler cleanup.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-request-timeout-support.ts:111`

#### EH-110: this Web handler owns a timer fiber outside the request Effect.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-request-timeout-support.ts:105`

### Effect · `effecttsgo/strict-effect-provide`

#### EH-111: test entry point needs a fresh isolated layer per run.

**Locations:**

- `packages/nearly-headless-cms/test/contract/authorization-expansion-support.ts:65`
- `packages/nearly-headless-cms/test/integration/cms-service.test.ts:44`
- `packages/nearly-headless-cms/test/integration/definition-lifecycle.test.ts:19`
- `packages/nearly-headless-cms/test/integration/definition-lifecycle.test.ts:25`
- `packages/nearly-headless-cms/test/integration/definition-lifecycle.test.ts:31`
- `packages/nearly-headless-cms/test/integration/entry-history.test.ts:17`

#### EH-112: test entry point needs a fresh isolated layer.

**Locations:**

- `packages/nearly-headless-cms/test/contract/http-contract-deletion-scenarios.ts:19`
- `packages/nearly-headless-cms/test/contract/http-contract-management-scenarios.ts:20`
- `packages/nearly-headless-cms/test/contract/http-contract-multipart-scenarios.ts:48`
- `packages/nearly-headless-cms/test/contract/http-contract-transport-scenarios.ts:46`
- `packages/nearly-headless-cms/test/contract/http-contract-transport-scenarios.ts:66`
- `packages/nearly-headless-cms/test/filesystem/filesystem-commit-boundary-child-scenarios.ts:22`
- `packages/nearly-headless-cms/test/filesystem/filesystem-commit-boundary-scenarios.ts:20`
- `packages/nearly-headless-cms/test/filesystem/filesystem-concurrency-fault-scenarios.ts:40`
- `packages/nearly-headless-cms/test/filesystem/filesystem-fault-injection-manifest-scenarios.ts:48`
- `packages/nearly-headless-cms/test/filesystem/filesystem-fault-injection-scenarios.ts:26`
- `packages/nearly-headless-cms/test/filesystem/filesystem-fault-injection-scenarios.ts:34`
- `packages/nearly-headless-cms/test/filesystem/filesystem-persistence-corruption-scenarios.ts:32`
- `packages/nearly-headless-cms/test/filesystem/filesystem-persistence-scenarios.ts:207`
- `packages/nearly-headless-cms/test/filesystem/filesystem-persistence-writer-scenarios.ts:24`
- `packages/nearly-headless-cms/test/filesystem/filesystem-persistence-writer-scenarios.ts:34`
- `packages/nearly-headless-cms/test/integration/asset-http-delivery.test.ts:25`
- `packages/nearly-headless-cms/test/integration/http-socket-integration-backpressure-scenarios.ts:20`
- `packages/nearly-headless-cms/test/integration/http-socket-integration-body-limit-scenarios.ts:31`
- `packages/nearly-headless-cms/test/integration/http-socket-integration-disconnect-scenarios.ts:26`
- `packages/nearly-headless-cms/test/integration/http-socket-integration-multipart-scenarios.ts:45`
- `packages/nearly-headless-cms/test/integration/http-socket-integration-scenarios.ts:12`
- `packages/nearly-headless-cms/test/integration/http-socket-integration-slow-producer-scenarios.ts:20`
- `packages/nearly-headless-cms/test/integration/http-socket-integration-timeout-scenarios.ts:27`

#### EH-285: acceptance journey entry point needs a fresh isolated layer.

**Locations:**

- `packages/nearly-headless-cms/test/integration/definition-migration-journey-scenarios.ts:70`

### ESLint · `eslint/func-style`

#### EH-113: error status helpers are function declarations to keep CmsError Schema narrowing readable.

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

#### EH-314: axe script server starts lazily when acceptance servers are ready.

**Locations:**

- `acceptance/accessibility/axe-webview.test.ts:10`

### ESLint · `eslint/max-lines-per-function`

#### EH-118: escape hatch parsing and rendering are intentionally colocated.

**Locations:**

- `scripts/escape-hatches-parse-support.ts:89`

#### EH-216: escape hatch registry CLI uses async filesystem IO.

**Locations:**

- `scripts/escape-hatches-registry-support.ts:73`
- `scripts/escape-hatches-registry-support.ts:169`

#### EH-217: React panel helpers exceed function line budget after typed prop alias escape hatches.

**Locations:**

- `apps/example-cms/src/ui/assets-page-dialogs-support.tsx:108`
- `apps/example-cms/src/ui/assets-page-header-support.tsx:3`
- `apps/example-cms/src/ui/assets-page-header-support.tsx:103`
- `apps/example-cms/src/ui/assets-page-panels-support.tsx:54`
- `apps/example-cms/src/ui/entry-editor-publication-panel-sections-support.tsx:52`
- `apps/example-cms/src/ui/entry-editor-story-canvas-fields-support.tsx:64`
- `apps/example-cms/src/ui/entry-editor-story-canvas-support.tsx:35`

#### EH-240: escape hatch document rendering is intentionally colocated.

**Locations:**

- `scripts/escape-hatches-render-support.ts:38`

#### EH-254: shutdown scenario keeps orchestration in one place for readability.

**Locations:**

- `packages/nearly-headless-cms/test/integration/http-socket-integration-shutdown-scenarios.ts:9`

#### EH-293: child spawn script must stay in one function for eval readability.

**Locations:**

- `packages/nearly-headless-cms/test/filesystem/filesystem-commit-boundary-child-spawn.ts:11`

### ESLint · `eslint/max-params`

#### EH-218: escape hatch parsing and rendering are intentionally colocated.

**Locations:**

- `scripts/escape-hatches-parse-support.ts:89`

### ESLint · `eslint/max-statements`

#### EH-219: escape hatch parsing and rendering are intentionally colocated.

**Locations:**

- `scripts/escape-hatches-parse-support.ts:89`

#### EH-220: escape hatch registry CLI uses async filesystem IO.

**Locations:**

- `scripts/escape-hatches-registry-support.ts:12`
- `scripts/escape-hatches-registry-support.ts:73`
- `scripts/escape-hatches-registry-support.ts:169`
- `scripts/escape-hatches-support.ts:7`

#### EH-229: registry formatting keeps comment rendering colocated.

**Locations:**

- `scripts/escape-hatches-registry-support.ts:51`

#### EH-241: escape hatch document rendering is intentionally colocated.

**Locations:**

- `scripts/escape-hatches-render-support.ts:38`

#### EH-242: registry rendering keeps family grouping colocated.

**Locations:**

- `scripts/escape-hatches-render-support.ts:72`

### ESLint · `eslint/no-await-in-loop`

#### EH-120: file scans and updates must preserve source order.

**Locations:**

- `scripts/escape-hatches-parse-support.ts:174`
- `scripts/escape-hatches-registry-support.ts:182`
- `scripts/escape-hatches-registry-support.ts:205`

### ESLint · `eslint/no-continue`

#### EH-121: registry assignment skips unresolved rule and code pairs.

**Locations:**

- `scripts/escape-hatches-registry-support.ts:27`
- `scripts/escape-hatches-registry-support.ts:134`
- `scripts/escape-hatches-registry-support.ts:140`

### ESLint · `eslint/no-ternary`

#### EH-124: registry formatting keeps compact comment labels.

**Locations:**

- `scripts/escape-hatches-registry-support.ts:56`
- `scripts/escape-hatches-registry-support.ts:64`
- `scripts/escape-hatches-registry-support.ts:202`

#### EH-230: registry helpers keep related declarations grouped.

**Locations:**

- `scripts/escape-hatches-parse-support.ts:129`
- `scripts/escape-hatches-parse-support.ts:131`

#### EH-237: generated fetch bridge keeps compact signal fallback.

**Locations:**

- `apps/example-cms/src/generated/headless-openapi-client-runtime-transport.ts:54`
- `apps/example-cms/src/generated/management-openapi-client-runtime-transport.ts:54`
- `apps/public-blog/src/generated/headless-openapi-client-runtime-transport.ts:54`
- `scripts/openapi-client-generator/runtime-template.ts:147`

### ESLint · `eslint/one-var`

#### EH-125: helpers with readonly disables must stay as separate const declarations.

**Locations:**

- `packages/nearly-headless-cms/src/cms-entry-expansion-relationship-support.ts:94`
- `packages/nearly-headless-cms/src/cms-entry-expansion-relationship-support.ts:139`
- `packages/nearly-headless-cms/src/entry-query-projection.ts:13`

#### EH-126: registry helpers keep related declarations grouped.

**Locations:**

- `scripts/escape-hatches-parse-support.ts:118`
- `scripts/escape-hatches-parse-support.ts:125`
- `scripts/escape-hatches-parse-support.ts:131`
- `scripts/escape-hatches-parse-support.ts:134`
- `scripts/escape-hatches-registry-support.ts:18`
- `scripts/escape-hatches-registry-support.ts:30`
- `scripts/escape-hatches-registry-support.ts:61`
- `scripts/escape-hatches-registry-support.ts:91`
- `scripts/escape-hatches-registry-support.ts:137`
- `scripts/escape-hatches-registry-support.ts:143`
- `scripts/escape-hatches-support.ts:26`
- `scripts/escape-hatches-support.ts:45`

#### EH-221: registry formatting keeps compact comment labels.

**Locations:**

- `scripts/escape-hatches-registry-support.ts:202`

#### EH-223: registry parsing uses ASCII comment markers only.

**Locations:**

- `scripts/escape-hatches-parse-support.ts:78`
- `scripts/escape-hatches-parse-support.ts:100`

#### EH-255: transport startup keeps separate statements so lint autofix does not merge dependency-ordered locals.

**Locations:**

- `packages/nearly-headless-cms/src/bun/http/bun-http-transport-support.ts:24`
- `packages/nearly-headless-cms/src/bun/http/bun-http-transport-support.ts:26`
- `packages/nearly-headless-cms/src/bun/http/bun-http-transport-support.ts:41`
- `packages/nearly-headless-cms/src/bun/http/bun-http-transport-support.ts:43`

#### EH-286: commit exit must follow the chmod yield before assertions.

**Locations:**

- `packages/nearly-headless-cms/test/filesystem/filesystem-fault-injection-scenarios.ts:89`

#### EH-287: read-back must follow the restore-chmod yield before assertions.

**Locations:**

- `packages/nearly-headless-cms/test/filesystem/filesystem-fault-injection-scenarios.ts:109`

#### EH-299: commit exit must follow the manifest obstruction yield before assertions.

**Locations:**

- `packages/nearly-headless-cms/test/filesystem/filesystem-fault-injection-manifest-scenarios.ts:62`

#### EH-300: read-back must follow manifest obstruction cleanup before assertions.

**Locations:**

- `packages/nearly-headless-cms/test/filesystem/filesystem-fault-injection-manifest-scenarios.ts:82`

#### EH-315: exported bindings follow private fixture resolution in the same module.

**Locations:**

- `acceptance/accessibility/axe-webview-support.ts:57`

#### EH-325: query response body and first item are parsed together after the status guard.

**Locations:**

- `acceptance/visual/visual-baseline-management-support.ts:35`

#### EH-335: conflict setup reads entry state after the editor finishes loading.

**Locations:**

- `acceptance/visual/visual-baseline-scenarios.ts:151`
- `acceptance/visual/visual-baseline-scenarios.ts:158`

#### EH-336: CORS header mutation follows the origin allowlist guard.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-preflight-support.ts:33`

### ESLint · `eslint/require-unicode-regexp`

#### EH-127: registry parsing uses ASCII comment markers only.

**Locations:**

- `scripts/escape-hatches-parse-support.ts:33`
- `scripts/escape-hatches-parse-support.ts:37`
- `scripts/escape-hatches-parse-support.ts:41`
- `scripts/escape-hatches-parse-support.ts:69`
- `scripts/escape-hatches-parse-support.ts:78`
- `scripts/escape-hatches-parse-support.ts:100`
- `scripts/escape-hatches-parse-support.ts:120`
- `scripts/escape-hatches-render-support.ts:19`
- `scripts/escape-hatches-support.ts:19`

### ESLint · `eslint/sort-imports`

#### EH-128: export route imports follow dependency grouping.

**Locations:**

- `apps/example-cms/src/delivery-export-route-support.ts:3`
- `apps/example-cms/src/delivery-export-route-support.ts:12`

#### EH-129: history panel imports follow UI dependency grouping.

**Locations:**

- `apps/example-cms/src/ui/entry-editor-history-panel-body.tsx:2`
- `apps/example-cms/src/ui/entry-editor-history-panel-body.tsx:5`
- `apps/example-cms/src/ui/entry-editor-history-panel-body.tsx:7`
- `apps/example-cms/src/ui/entry-editor-history-panel-body.tsx:9`
- `apps/example-cms/src/ui/entry-editor-history-panel-body.tsx:11`

#### EH-238: multi-specifier type imports precede single-specifier imports in this validation module.

**Locations:**

- `packages/nearly-headless-cms/src/content-definition-entry-validation.ts:12`

#### EH-256: Bun transport layer imports follow handler, Effect, and transport dependency order.

**Locations:**

- `packages/nearly-headless-cms/src/bun/http/bun-http-transport.ts:1`
- `packages/nearly-headless-cms/src/bun/http/bun-http-transport.ts:3`
- `packages/nearly-headless-cms/src/bun/http/bun-http-transport.ts:5`
- `packages/nearly-headless-cms/src/bun/http/bun-http-transport.ts:7`

#### EH-257: Bun transport startup imports follow Effect, failure mapping, and lifecycle dependency order.

**Locations:**

- `packages/nearly-headless-cms/src/bun/http/bun-http-transport-support.ts:1`
- `packages/nearly-headless-cms/src/bun/http/bun-http-transport-support.ts:3`
- `packages/nearly-headless-cms/src/bun/http/bun-http-transport-support.ts:5`

#### EH-296: child spawn imports follow bun, node, and support dependency order.

**Locations:**

- `packages/nearly-headless-cms/test/filesystem/filesystem-commit-boundary-child-spawn.ts:5`

### ESLint · `eslint/sort-vars`

#### EH-131: helper declaration order follows dependency order.

**Locations:**

- `packages/nearly-headless-cms/src/cms-entry-expansion-field-group-support.ts:77`
- `packages/nearly-headless-cms/src/cms-entry-expansion-relationship-support.ts:74`
- `packages/nearly-headless-cms/src/cms-entry-references-path-support.ts:35`
- `packages/nearly-headless-cms/src/cms-entry-references-path-support.ts:55`
- `packages/nearly-headless-cms/src/cms-entry-references-path-support.ts:71`
- `packages/nearly-headless-cms/src/cms-entry-references-path-support.ts:89`
- `packages/nearly-headless-cms/src/cms-entry-references-support.ts:64`
- `packages/nearly-headless-cms/src/cms-entry-references-support.ts:94`
- `packages/nearly-headless-cms/src/cms-entry-references-support.ts:134`
- `packages/nearly-headless-cms/src/content-definition-entry-validation.ts:185`
- `packages/nearly-headless-cms/src/content-definition-entry-validation.ts:213`

#### EH-132: registry helpers follow parse, assign, and render order.

**Locations:**

- `scripts/escape-hatches-parse-support.ts:15`
- `scripts/escape-hatches-parse-support.ts:18`
- `scripts/escape-hatches-parse-support.ts:20`
- `scripts/escape-hatches-parse-support.ts:39`
- `scripts/escape-hatches-parse-support.ts:179`
- `scripts/escape-hatches-registry-support.ts:10`
- `scripts/escape-hatches-registry-support.ts:20`
- `scripts/escape-hatches-registry-support.ts:32`
- `scripts/escape-hatches-registry-support.ts:34`
- `scripts/escape-hatches-registry-support.ts:103`
- `scripts/escape-hatches-registry-support.ts:105`
- `scripts/escape-hatches-registry-support.ts:131`
- `scripts/escape-hatches-registry-support.ts:145`
- `scripts/escape-hatches-registry-support.ts:187`
- `scripts/escape-hatches-registry-support.ts:189`
- `scripts/escape-hatches-support.ts:48`

#### EH-133: test constants follow scenario narrative order.

**Locations:**

- `packages/nearly-headless-cms/test/contract/authorization-expansion.test.ts:134`

#### EH-225: escape hatch registry CLI uses async filesystem IO.

**Locations:**

- `scripts/escape-hatches-parse-support.ts:53`
- `scripts/escape-hatches-registry-support.ts:73`
- `scripts/escape-hatches-support.ts:35`

#### EH-226: registry formatting keeps compact comment labels.

**Locations:**

- `scripts/escape-hatches-registry-support.ts:56`

#### EH-231: escape hatch registry helpers are intentionally direct-call only.

**Locations:**

- `scripts/escape-hatches-registry-support.ts:211`

#### EH-232: registry formatting keeps comment rendering colocated.

**Locations:**

- `scripts/escape-hatches-registry-support.ts:51`

#### EH-233: registry helpers keep related declarations grouped.

**Locations:**

- `scripts/escape-hatches-parse-support.ts:125`
- `scripts/escape-hatches-parse-support.ts:129`

#### EH-258: archive path depends on the resolved package manifest version.

**Locations:**

- `scripts/compatibility-matrix.ts:10`
- `scripts/record-release-evidence.ts:11`

#### EH-259: branch text is trimmed immediately into the release evidence artifact field.

**Locations:**

- `scripts/record-release-evidence.ts:14`

#### EH-260: commit text is trimmed immediately into the release evidence artifact field.

**Locations:**

- `scripts/record-release-evidence.ts:18`

#### EH-261: evidence object aggregates the resolved release metadata fields.

**Locations:**

- `scripts/record-release-evidence.ts:28`

#### EH-262: export programs are declared before the runtime that executes them.

**Locations:**

- `apps/public-blog/src/fetch-export.ts:123`

#### EH-263: fixture install helpers are declared before the export programs that call them.

**Locations:**

- `apps/public-blog/src/fetch-export.ts:76`

#### EH-264: forced shutdown locals follow lifecycle, handler, and server order.

**Locations:**

- `packages/nearly-headless-cms/test/integration/http-socket-integration-forced-shutdown-scenarios.ts:8`

#### EH-265: generated-at text is trimmed immediately into the release evidence artifact field.

**Locations:**

- `scripts/record-release-evidence.ts:22`

#### EH-266: handler effect is declared before the form factory it configures.

**Locations:**

- `packages/nearly-headless-cms/test/integration/asset-http-delivery.test.ts:20`

#### EH-267: hanging handler follows lifecycle construction.

**Locations:**

- `packages/nearly-headless-cms/test/integration/http-socket-integration-forced-shutdown-scenarios.ts:12`

#### EH-268: inspection report parsing follows the resolved archive and git metadata fields.

**Locations:**

- `scripts/record-release-evidence.ts:25`

#### EH-269: lifecycle construction follows slow handler setup.

**Locations:**

- `packages/nearly-headless-cms/test/integration/http-socket-integration-shutdown-scenarios.ts:24`

#### EH-270: lifecycle helpers follow drain, force-stop, hook, wrap, and factory order.

**Locations:**

- `packages/nearly-headless-cms/src/http/http-transport-lifecycle-support.ts:41`
- `packages/nearly-headless-cms/src/http/http-transport-lifecycle-support.ts:50`
- `packages/nearly-headless-cms/src/http/http-transport-lifecycle-support.ts:66`
- `packages/nearly-headless-cms/src/http/http-transport-lifecycle-support.ts:90`
- `packages/nearly-headless-cms/src/http/http-transport-lifecycle-support.ts:119`

#### EH-271: live server follows hanging handler construction.

**Locations:**

- `packages/nearly-headless-cms/test/integration/http-socket-integration-forced-shutdown-scenarios.ts:17`

#### EH-272: response verifiers follow the HTTP scenario narrative order.

**Locations:**

- `packages/nearly-headless-cms/test/integration/asset-http-delivery.test.ts:102`

#### EH-273: server startup follows lifecycle construction.

**Locations:**

- `packages/nearly-headless-cms/test/integration/http-socket-integration-shutdown-scenarios.ts:28`

#### EH-274: shutdown scenario locals follow handler, server, and request order.

**Locations:**

- `packages/nearly-headless-cms/test/integration/http-socket-integration-shutdown-scenarios.ts:11`

#### EH-275: slow handler factory precedes lifecycle and server setup.

**Locations:**

- `packages/nearly-headless-cms/test/integration/http-socket-integration-shutdown-scenarios.ts:15`

#### EH-301: commit helper closes over firstEntryIdentifier declared above.

**Locations:**

- `packages/nearly-headless-cms/test/filesystem/filesystem-fault-injection-manifest-scenarios.ts:16`

#### EH-306: slow consumer reads intentionally await Bun.sleep between stream chunks; readNextChunk closes over reader.

**Locations:**

- `packages/nearly-headless-cms/test/integration/http-socket-integration-backpressure-scenarios.ts:55`

#### EH-307: submissions path follows handler construction in this socket scenario.

**Locations:**

- `packages/nearly-headless-cms/test/integration/http-socket-integration-body-limit-scenarios.ts:34`

#### EH-308: upload path follows handler construction in this socket scenario.

**Locations:**

- `packages/nearly-headless-cms/test/integration/http-socket-integration-backpressure-scenarios.ts:23`
- `packages/nearly-headless-cms/test/integration/http-socket-integration-slow-producer-scenarios.ts:30`

#### EH-310: paced multipart body closes over header and footer bytes declared above.

**Locations:**

- `packages/nearly-headless-cms/test/integration/http-socket-integration-slow-producer-scenarios.ts:37`

#### EH-337: draft identifiers are resolved before lighthouse fixture values are copied.

**Locations:**

- `acceptance/visual/visual-baseline-scenarios.ts:18`

#### EH-341: editor navigation depends on waitUntilExpression despite alphabetical ordering.

**Locations:**

- `acceptance/visual/visual-baseline-scenarios.ts:63`

#### EH-342: featured asset selection follows lighthouse fixture lookup.

**Locations:**

- `acceptance/visual/visual-baseline-scenarios.ts:24`

#### EH-345: conflict preparation follows controlled input setup despite alphabetical ordering.

**Locations:**

- `acceptance/visual/visual-baseline-scenarios.ts:148`

#### EH-347: controlled input updates precede conflict preparation despite alphabetical ordering.

**Locations:**

- `acceptance/visual/visual-baseline-scenarios.ts:128`

#### EH-349: journey orchestration follows helper dependency order despite alphabetical ordering.

**Locations:**

- `acceptance/webview/journey.test.ts:150`

### ESLint · `no-await-in-loop`

#### EH-134: checks intentionally run sequentially.

**Locations:**

- `scripts/check-architecture.ts:222`

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

### Unicorn · `unicorn/no-array-sort`

#### EH-209: registry keys are sorted in place before code assignment.

**Locations:**

- `scripts/escape-hatches-parse-support.ts:57`
- `scripts/escape-hatches-registry-support.ts:93`

### Unicorn · `unicorn/prefer-number-coercion`

#### EH-214: registry code numbers are parsed from fixed-width labels.

**Locations:**

- `scripts/escape-hatches-registry-support.ts:43`
- `scripts/escape-hatches-render-support.ts:24`

### Unicorn · `unicorn/prefer-ternary`

#### EH-215: registry defaults keep explicit branch justifications.

**Locations:**

- `scripts/escape-hatches-parse-support.ts:150`

#### EH-234: registry formatting keeps compact comment labels.

**Locations:**

- `scripts/escape-hatches-registry-support.ts:56`
- `scripts/escape-hatches-registry-support.ts:64`
