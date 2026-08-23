# Build the example applications on Effect and Bun

The Example CMS uses a Bun-native client-rendered React application hosted by Effect's Bun HTTP platform, while the independently built Public Blog uses Astro static generation from one coherent Headless API export and is served by Effect on Bun. This deliberately favors Effect-managed schemas, HTTP, failures, resources, and lifecycle plus Bun-native bundling, HMR, builds, tests, process running, and WebView over conventional Vite, Hono, server-rendering, client-generation, process-runner, and browser-test stacks; the tradeoff is more app-owned code and explicit prototype gates for the custom Rich Text editor, Astro-on-Bun, and experimental WebView.

## Consequences

- The reusable library remains UI-agnostic and the Public Blog proves the ordinary HTTP/OpenAPI boundary.
- Dependencies stay application-local and are added only where the platform does not supply the required capability.
- The custom OpenAPI generator and Rich Text editor become substantial owned modules with narrow interfaces and focused verification.
- The demonstration runtime is Bun even after an ahead-of-time build; no production hosting platform is selected.

## Alternatives considered

- **Vite or a React server framework**: mature frontend tooling, but duplicates Bun 1.4's native HTML-import bundling, HMR, and serving for this demonstration.
- **Hono or another HTTP framework**: convenient routing, but duplicates the selected Effect `HttpApi` and Bun adapter.
- **Orval or a shared SDK**: reduces generator work, but either adds an avoidable dependency or violates the app-local Headless binding boundary.
- **Tiptap or another Rich Text toolkit**: lowers editor risk, but the example intentionally demonstrates an app-owned editor over the portable semantic contract.
- **Playwright or a simulated DOM**: broader test ergonomics, but Bun WebView plus pure `bun:test` coverage is sufficient for the macOS v0.1 acceptance target.
