import type { AcceptanceCase } from "./v0.1.ts";
import { automated } from "./v0.1-builders.ts";

export const acceptanceCasesA: readonly AcceptanceCase[] = [
  automated({
    claim:
      "Complete serializable snapshots compile deterministically and invalid graphs leave the active snapshot unchanged.",
    command: "bun test packages/nearly-headless-cms/test/unit",
    id: "DEF-001",
    level: "unit",
    owner: "library",
    selector: "ContentDefinition.compile",
    source: "issue #21",
  }),
  automated({
    claim:
      "Definition identifiers, Field Group cycles, collisions, unknown kinds, and fingerprints are validated.",
    command: "bun test packages/nearly-headless-cms/test/unit",
    id: "DEF-002",
    level: "unit",
    owner: "library",
    selector: "ContentDefinition graph validation",
    source: "issue #21",
  }),
  automated({
    claim:
      "Built-in Field Kinds validate without coercion and creation-only defaults never appear on update.",
    command: "bun test packages/nearly-headless-cms/test",
    id: "FLD-001",
    level: "integration",
    owner: "library",
    selector: "Cms.Service validation",
    source: "issue #15",
  }),
  automated({
    claim: "Single scalar uniqueness is enforced atomically among live Entries.",
    command: "bun test packages/nearly-headless-cms/test/integration",
    id: "FLD-002",
    level: "integration",
    owner: "library",
    selector: "unique values",
    source: "issue #15",
  }),
  automated({
    claim:
      "Create, get, complete replacement, delete, and query use one Content Type and stable Entry representations.",
    command: "bun test packages/nearly-headless-cms/test/integration",
    id: "ENT-001",
    level: "integration",
    owner: "library",
    selector: "Cms.Service",
    source: "issue #2",
  }),
  automated({
    claim:
      "Portable predicates, boolean groups, sorting, projection, limits, and deterministic Cursor pages never approximate.",
    command: "bun test packages/nearly-headless-cms/test/unit/entry-query.test.ts",
    id: "QRY-001",
    level: "unit",
    owner: "library",
    selector: "EntryQuery.evaluate",
    source: "issue #2",
  }),
  automated({
    claim: "Stale, invalid, or differently bound Cursors return a typed failure.",
    command: "bun test packages/nearly-headless-cms/test/unit/entry-query.test.ts",
    id: "QRY-002",
    level: "unit",
    owner: "library",
    selector: "cursor binding",
    source: "issue #2",
  }),
  automated({
    claim:
      "Relationship targets validate atomically and inbound live references restrict deletion without referrer disclosure.",
    command: "bun test packages/nearly-headless-cms/test/integration",
    id: "REL-001",
    level: "integration",
    owner: "library",
    selector: "Relationship integrity",
    source: "issue #11",
  }),
  automated({
    claim:
      "Relationship Expansion is explicit, bounded, cycle-safe, and separately authorized once.",
    command: "bun test packages/nearly-headless-cms/test/contract",
    id: "REL-002",
    level: "contract",
    owner: "library",
    selector: "authorization and expansion",
    source: "issue #11",
  }),
  automated({
    claim:
      "History-enabled mutations create immutable revisions with opaque Write Tokens and stale writes change nothing.",
    command: "bun test packages/nearly-headless-cms/test/integration",
    id: "HIS-001",
    level: "integration",
    owner: "library",
    selector: "history-aware concurrency",
    source: "issue #16",
  }),
  automated({
    claim:
      "Deletion records, restoration, retention, and Permanent Purge preserve the settled state machine.",
    command: "bun test packages/nearly-headless-cms/test/integration",
    id: "HIS-002",
    level: "integration",
    owner: "library",
    selector: "history state transitions",
    source: "issue #16",
  }),
  automated({
    claim:
      "One-to-one Migration Handlers prepare fully valid target Entries and preparation becomes stale after a source write.",
    command: "bun test packages/nearly-headless-cms/test/unit/definition-migration.test.ts",
    id: "MIG-001",
    level: "unit",
    owner: "library",
    selector: "DefinitionMigration.prepare",
    source: "issue #10",
  }),
  automated({
    claim:
      "Migration graphs admit at most one directed path and rollback is an explicit forward edge.",
    command: "bun test packages/nearly-headless-cms/test/unit/definition-migration.test.ts",
    id: "MIG-002",
    level: "unit",
    owner: "library",
    selector: "DefinitionMigration.validateGraph",
    source: "issue #10",
  }),
  automated({
    claim:
      "Core semantic Rich Text validates placement, marks, references, and visibly rejects unsupported extensions.",
    command: "bun test packages/nearly-headless-cms/test/unit/rich-text.test.ts",
    id: "RTX-001",
    level: "unit",
    owner: "library",
    selector: "RichText",
    source: "issue #17",
  }),
  automated({
    claim:
      "The app-owned editor normalizes semantic transactions and preserves bounded undo/redo across save.",
    command: "bun test apps/example-cms/test/unit/rich-text-editor.test.ts",
    id: "RTX-002",
    level: "unit",
    owner: "example-cms",
    selector: "RichTextEditor",
    source: "issue #6",
  }),
  automated({
    claim:
      "Every request has explicit Anonymous or opaque Actor identity with no library User model.",
    command: "bun run test:types",
    id: "IDN-001",
    level: "type",
    owner: "library",
    selector: "CurrentIdentity",
    source: "issue #13",
  }),
  automated({
    claim:
      "Generic operations authorize at the public seam before lookup and expose no trusted bypass.",
    command: "bun test packages/nearly-headless-cms/test/contract",
    id: "AUT-001",
    level: "contract",
    owner: "library",
    selector: "authorization ordering",
    source: "issue #13",
  }),
  automated({
    adapter: "Bun filesystem",
    claim: "The Bun filesystem Adapter recovers immutable committed generations after restart.",
    command: "bun test packages/nearly-headless-cms/test/filesystem",
    id: "FSP-001",
    level: "filesystem",
    owner: "library",
    selector: "restart recovery",
    source: "issue #19",
  }),
  automated({
    adapter: "Bun filesystem",
    claim: "Asset Blobs are streamed, bounded, digest-addressed, and verified on read.",
    command: "bun test packages/nearly-headless-cms/test/filesystem",
    id: "FSP-002",
    level: "filesystem",
    owner: "library",
    selector: "Asset digest",
    source: "issue #19",
  }),
];
