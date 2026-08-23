# Prove v0.1 through contract traceability

Nearly Headless CMS accepts v0.1 by mapping every normative decision to stable automated or manual evidence rather than using a code-coverage percentage or a generic test pyramid as the release oracle. Shared Adapter conformance suites, real-boundary failure tests, a small set of complete-system journeys, selected visual baselines, and explicit accessibility and browser protocols provide evidence at the shallowest level capable of observing each contract; required evidence has zero automatic retries.

## Consequences

- The acceptance manifest becomes a maintained product artifact alongside the implementation.
- Internal refactoring does not invalidate tests unless an observable contract changes.
- Filesystem, networking, process, browser, and manual suites remain expensive but cannot be replaced by in-memory confidence.
- A flaky required test blocks acceptance instead of being retried or quarantined into a false pass.

## Alternatives considered

- **Global line or branch coverage thresholds**: easy to measure, but they reward execution without proving the settled invariants, failures, exclusions, and platform claims.
- **End-to-end-first acceptance**: realistic at the surface, but too slow and imprecise for exhaustive definition, query, migration, recovery, and transport behavior.
- **Release-only manual testing**: inexpensive to scaffold, but unauditable, irreproducible, and unable to protect CMS Builder Adapter contracts.
