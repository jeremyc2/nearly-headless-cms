# Example Application Stack

## Decision

The Example CMS is a client-rendered React application compiled, bundled, hot-reloaded, and served by Bun. Effect owns the application server, API declarations, handlers, middleware, failures, resources, and lifecycle through `@effect/platform-bun`; the adapter owns the underlying `Bun.serve` instance. Bun HTML-import routes and Effect `HttpApi` routes share that one server. The application uses no Vite, Hono, React server rendering framework, or separate frontend development server.

The Public Blog is a separately runnable Astro application with static output. Its build consumes the Example CMS only through one coherent Headless API export, writes static HTML, CSS, JavaScript, Assets, and RSS output, and is served through Effect's static HTTP support backed by `@effect/platform-bun`. It imports neither the Example CMS nor the reusable library. It has no runtime server rendering.

Both applications assume Bun as their development, build, test, and demonstration runtime. The repository supplies a demonstration build, but makes no production-hosting claim.

## Version and dependency policy

Direct dependencies are pinned to exact versions and the Bun lockfile is committed. "Latest Effect" means the latest mutually compatible Effect v4 release-candidate channel, not npm's Effect v3 `latest` tag. Other dependencies use their latest compatible stable release when the implementation lockfile is established. The versions verified for this decision are:

| Dependency | Version |
| --- | --- |
| Bun, `bun-types`, and `@types/bun` | `1.4.0` |
| `effect` and `@effect/platform-bun` | `4.0.0-rc.111` |
| TypeScript | `7.0.2` |
| React and React DOM | `19.2.8` |
| TanStack Router | `1.170.32` |
| TanStack Query | `5.102.2` |
| Astro | `7.2.4` |
| `@astrojs/rss` | `4.0.19` |
| Tailwind CSS and `@tailwindcss/vite` | `4.3.3` |
| `bun-plugin-tailwind` | `0.1.2` |

Dependencies remain application-local unless the reusable library's public contract requires them. Development tools that the platform already supplies are not replaced with third-party equivalents.

## Example CMS application

### Server, bundling, and lifecycle

The Example CMS composes its Management API, Headless API, static React route, health route, and documentation routes into one Effect application. `HttpRouter.serve` is provided by `BunHttpServer.layer`, and `BunRuntime.runMain` runs the scoped program. Effect acquisition and release semantics govern server startup, shutdown, background fibers, readiness-dependent subprocesses, staged uploads, and other resources.

Bun HTML imports are the React entry point. In development, Bun performs TypeScript and JSX compilation, CSS and asset bundling, React Fast Refresh, HMR, source maps, and browser-console forwarding. Normal demonstration use may rely on Bun's runtime bundling. A repository-owned TypeScript build script also invokes `Bun.build` for an ahead-of-time Bun-targeted demonstration build. The build script supplies `bun-plugin-tailwind` explicitly because Bun's CLI build does not apply static serve plugins.

The application is a client-rendered SPA. Server rendering and hydration would add a second rendering model without improving the open-access authoring demonstration.

### Navigation and server state

TanStack Router uses a manually declared, code-based route tree. The application adds neither a router generator nor a bundler plugin. Router context carries one TanStack Query client and the Effect managed runtime or generated Management-client facade needed by loaders. Route loaders may use `ensureQueryData` to avoid waterfalls.

TanStack Query owns Management API cache and remote request state for Entry lists and details, history, Content Definitions, Assets, and Entry or Asset pickers. Every Query function invokes the generated Effect client through the managed runtime and passes the Query `AbortSignal` to Effect so cancellation interrupts the fiber. TanStack Query does not replace Effect HTTP, Effect Schema, typed failures, or domain services.

The central retry policy retries only `TransportFailure` and declared retryable `InfrastructureFailure` responses, at most twice with bounded backoff and a bounded `Retry-After`. It never retries `ProtocolFailure`, `UnsupportedDefinition`, validation, authorization, absence, conflict, or other domain failures. Mutations do not retry by default; an explicitly idempotent command may opt into the same transient policy.

### Forms and responsive layout

The Example CMS uses semantic native form controls and app-owned React state rather than a form library or React form Actions. A deep form module owns drafts, touched state, and local issues; Effect Schema performs local decoding; TanStack mutations perform remote submission and cache invalidation. Server validation remains authoritative.

Content Definitions carry no layout width. The Example CMS derives responsive layout from Field Kind: one column on small screens, six grid columns at medium widths, and twelve on desktop. Boolean, number, date, and other short constrained controls use compact spans; ordinary text, Asset, and Relationship controls use medium spans; multiline text, Rich Text, JSON, lists, and complex Field Groups span the full width. App-owned components may refine these application-local heuristics without adding presentation metadata to a Content Definition.

### Components, styling, and API documentation

The application owns its React components and uses semantic native elements, including native dialogs where appropriate. It adds no component suite. Tailwind CSS v4 supplies utility styling through `bun-plugin-tailwind`; shared CSS custom properties may express application-local design tokens.

The Example CMS mounts separate Effect Scalar documentation routes for the Management and Headless APIs. Management documentation passes through Management middleware. These routes are demonstration features; the reusable library supplies OpenAPI JSON rather than a documentation user interface.

## Typed client bindings

Effect `HttpApi` declarations produce the canonical Management and Headless OpenAPI 3.1 documents. A narrow repository-owned Bun generator reads only those exported documents and emits separate app-local TypeScript operation types and Effect `HttpClient` wrappers. The generator supports only the controlled OpenAPI subset emitted by these APIs and fails on an unsupported construct, missing or duplicate operation identifier, or unrepresentable response.

The generator does not import a server `HttpApi` declaration and does not attempt to implement a general OpenAPI generator. Management and Headless bindings therefore exercise the same HTTP boundary even when the Example CMS could share implementation types. Handwritten app-local Effect Schemas decode runtime discovery, dynamic Entry values, Field Kinds, and Rich Text extensions.

Canonical OpenAPI documents and generated binding source are committed. A deterministic `check:generated` command regenerates and byte-compares them, including a generator-format version. Development and builds never regenerate them implicitly. Orval, a shared SDK, and other client generators are not dependencies.

## App-owned Rich Text editor

The Example CMS implements one deep, app-owned `RichTextEditor` module instead of depending on an editor toolkit. The reusable library remains UI-agnostic.

The module contains a pure synchronous transaction engine and an imperative browser adapter. Its private state contains the semantic Rich Text document, model selection, pending marks, normalized undo and redo history, and transient composition or node identity. React owns only the shell, toolbar, dialogs, validation presentation, and picker callbacks. The browser adapter exclusively owns an otherwise childless `contentEditable` host; React does not reconcile browser-mutated editable descendants.

The semantic document is always the source of truth. Input, selection, composition, keyboard, clipboard, and drop events produce typed editor commands; commands return normalized state; the adapter renders that state without `innerHTML` and restores the DOM selection. Unexpected native mutations are detected and reverted. Selection, history, DOM structure, editor identities, and composition state never cross `onChange` or persistence.

The transaction vocabulary covers text insertion and deletion, block splitting and merging, block-kind changes, list operations, mark toggles, link wrapping, Entry-reference insertion, Asset-reference insertion, and undo and redo. Normalization merges adjacent equivalent text leaves, canonicalizes mark sets, removes invalid wrappers, enforces child placement, and represents an empty editor as a document containing one empty paragraph.

The Example CMS exposes paragraphs, headings two through four, ordered and unordered lists, list items, quotes, code blocks, links, the four core marks, Entry references, and Asset references. It preserves valid core nodes its toolbar does not create. Paste and drop accept plain text only; the editor never imports arbitrary HTML.

An Entry reference wraps a non-empty selection as its authored label. A collapsed selection opens a dialog that requires a label. An Asset reference is an atomic block card configured by an Asset picker, authored alternative text, and optional caption. A draft may contain empty image alternative text, while Post publication requires it. Marks may occur within link and Entry-reference labels, but links and Entry references cannot nest in each other. Live reference and publication validation remains authoritative in the atomic server operation.

Keyboard behavior includes conventional `Cmd+B`, `Cmd+I`, `Cmd+K`, `Cmd+Z`, and `Shift+Cmd+Z`; Enter splits blocks or list items; Backspace merges or outdents at boundaries; Escape closes dialogs and restores focus. Bounded app-owned history coalesces adjacent typing and deletion. Saving marks the current position clean without erasing undo history; loading another Entry resets history.

The v0.1 automated interaction target is macOS desktop keyboard and mouse behavior. Composition is handled defensively, with VoiceOver and IME behavior as explicit manual prototype gates. Mobile and touch authoring, rich HTML paste, drag reordering, collaboration, Markdown shortcuts, tables, and media resizing are outside v0.1. If the complete-experience prototype exposes unacceptable selection, composition, or accessibility defects, the editor decision is revisited explicitly rather than silently dropping required Rich Text behavior or adding a dependency.

## Public Blog application

Astro uses static output, directory-format paths, and a configured canonical site URL. The delivered Public Blog contains static HTML, CSS, JavaScript, Assets, and RSS output and has no Astro server adapter. Tailwind CSS v4 is integrated through `@tailwindcss/vite`; the application does not depend on React, `@astrojs/react`, `@astrojs/tailwind`, Bun's Tailwind plugin, or a direct Vite package.

A build reaches a running Example CMS on its configured port and uses the generated Headless Effect client to fetch and validate exactly one `exportPublicBlog` response. It writes an uncommitted immutable intermediate snapshot. Every page, `getStaticPaths` expansion, archive, and `@astrojs/rss` route reads that same snapshot. Referenced immutable Assets are fetched separately through the Headless Asset Delivery Operation. An unavailable or invalid export fails the build rather than producing output from stale content.

The development loop also uses Astro in static-output mode. An Effect watcher conditionally checks the export ETag and atomically replaces the intermediate snapshot after a coherent export changes; Astro observes the source change and rebuilds through its development HMR loop. There is no content-refresh user interface and browser navigation never assembles public pages through live content queries.

The generated static page contains approved Comments from the export. A small processed Astro TypeScript script progressively enhances the semantic Comment form, calls the generated Headless Effect client with a stable idempotency key, and presents the pending receipt and accessible failures. The Public Blog has no TanStack dependency and makes no other browser-time content query.

Effect `HttpStaticServer` and `BunHttpServer` serve the generated `dist` directory with SPA fallback disabled. Astro development and build commands run through pinned Bun using `bunx --bun`. Because Astro declares a Node engine and documents possible Bun compatibility gaps, the complete-experience prototype must prove both `astro dev` and `astro build` on the pinned Bun release. Failure reopens the Astro choice; it does not silently add a Node runtime.

## Development and verification tools

`bun:test` covers domain behavior, Effect services, generated-client contracts, form and render models, Rich Text transactions and normalization, history, and other pure UI logic. Actual React and DOM behavior runs against the real applications through experimental Bun 1.4 `WebView` using the zero-external-browser macOS WebKit backend. The suite covers trusted typing and key input, navigation, dialogs and focus restoration, responsive viewport changes, semantic DOM and ARIA state, console failures, selected screenshots, submission, save-failure retention, and complete cross-application workflows.

WebView does not prove IME, native drag selection, clipboard integration, screen-reader output, or cross-browser compatibility. Those limitations are explicit manual gates. The repository adds no Playwright, Happy DOM, React Testing Library, or simulated DOM.

Ordinary independent development scripts use Bun 1.4's `bun run --no-orphans --parallel`, with prefixed output and fail-fast cleanup, instead of `concurrently` or `npm-run-all`. Readiness-dependent build and acceptance flows use a small repository-owned Effect program around `Bun.spawn`: acquire the CMS process, wait for its health route, run the scoped Astro build or WebView workflow, and release every child through Effect finalizers.

## Consequences

- The reference applications exercise Bun and Effect deeply without leaking either application's UI or runtime types into the reusable library.
- The Public Blog proves the Headless API boundary through generated app-local source and a coherent static export.
- The Example CMS remains a realistic dynamic authoring client while the Public Blog remains almost entirely static.
- Avoiding general-purpose client generation, form, component, editor, process-runner, DOM-test, and browser-test dependencies increases owned code, especially in the generator and Rich Text editor.
- Bun WebView and Astro-on-Bun are deliberate current-platform bets guarded by prototype gates.
