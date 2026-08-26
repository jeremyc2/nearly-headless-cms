/** Shared development dependencies: open authorization, anonymous identity, crypto identifiers. */
export * as CommonDependencies from "./common-dependencies.ts";
/** Filesystem-backed CMS layer with common development dependencies already wired. */
export * as Filesystem from "./filesystem.ts";
/** Entirely in-memory CMS layer for tests and quick starts. */
export * as InMemory from "./in-memory.ts";
