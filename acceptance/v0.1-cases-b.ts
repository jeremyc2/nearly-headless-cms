import type { AcceptanceCase } from "./v0.1.ts";
import { automated } from "./v0.1-builders.ts";

export const acceptanceCasesB: readonly AcceptanceCase[] = [
  automated({
    adapter: "Bun filesystem",
    claim:
      "One writer, exact staging cleanup, format markers, and atomic/durable acknowledgement failures are structured.",
    command: "bun test packages/nearly-headless-cms/test/filesystem",
    id: "FSP-003",
    level: "filesystem",
    owner: "library",
    selector: "writer and recovery",
    source: "issue #19",
  }),
  automated({
    claim:
      "Management and Headless contracts have separate versioned routes, direct bodies, headers, errors, and OpenAPI 3.1 documents.",
    command: "bun test packages/nearly-headless-cms/test/contract/http-contract.test.ts",
    id: "HTTP-001",
    level: "contract",
    owner: "library",
    selector: "HTTP contract",
    source: "issue #9",
  }),
  automated({
    claim:
      "Headless routes expose only composed Delivery Operations and never unrestricted CRUD or generic Query.",
    command: "bun test packages/nearly-headless-cms/test/contract/http-contract.test.ts",
    id: "HTTP-002",
    level: "contract",
    owner: "library",
    selector: "Headless absence",
    source: "issue #9",
  }),
  automated({
    claim:
      "Asset delivery uses immutable ETags, HEAD, one range, safe filenames, and 200/206/304/416 semantics.",
    command: "bun test packages/nearly-headless-cms/test/integration",
    id: "HTTP-003",
    level: "integration",
    owner: "library",
    selector: "Asset HTTP",
    source: "issue #9",
  }),
  automated({
    claim:
      "Canonical OpenAPI documents and separate app-local generated clients are deterministic.",
    command: "bun run check:generated",
    id: "GEN-001",
    level: "architecture",
    owner: "cross-system",
    selector: "generated artifacts",
    source: "issue #6",
  }),
  automated({
    claim:
      "The Example CMS defines Posts, Authors, Categories, Tags, Assets, and moderated Comments with deterministic seed content.",
    command: "bun test apps/example-cms/test/integration",
    id: "CMS-001",
    level: "integration",
    owner: "example-cms",
    selector: "Example Blog domain",
    source: "issue #5",
  }),
  automated({
    claim:
      "The responsive workbench exposes overview, queues, lists, Entry editors, Assets, history, and static-boundary state.",
    command: "bun run test:visual",
    id: "CMS-002",
    level: "visual",
    owner: "example-cms",
    selector: "CMS visual baselines",
    source: "issue #18",
  }),
  automated({
    adapter: "Headless HTTP",
    claim:
      "The static Public Blog exports only published Posts and approved Comments across all route families and RSS.",
    command: "bun run --cwd apps/public-blog build",
    id: "BLOG-001",
    level: "integration",
    owner: "public-blog",
    selector: "Astro static routes",
    source: "issue #5",
  }),
  automated({
    claim:
      "Static pages work without JavaScript; Comment enhancement is the sole browser-time content mutation.",
    command: "bun run check:architecture",
    id: "BLOG-002",
    level: "architecture",
    owner: "public-blog",
    selector: "Public Blog boundary",
    source: "issue #18",
  }),
  automated({
    adapter: "filesystem and Headless HTTP",
    claim:
      "A coherent public export builds the complete site and an unavailable export cannot replace prior output.",
    command: "bun run acceptance",
    id: "E2E-001",
    level: "journey",
    owner: "cross-system",
    selector: "static export journey",
    source: "issue #4",
  }),
  automated({
    claim:
      "CMS and Public Blog critical states match baselines at 390×844, 768×1024, and 1440×1000.",
    command: "bun run test:visual",
    id: "VIS-001",
    level: "visual",
    owner: "cross-system",
    selector: "visual baselines",
    source: "issue #4",
  }),
  automated({
    claim:
      "Critical pages expose semantic landmarks, headings, names, linked validation errors, focus visibility, and live status.",
    command: "bun run test:a11y && bun run test:webview",
    id: "A11Y-001",
    level: "journey",
    owner: "cross-system",
    selector: "semantic and keyboard journey",
    source: "issue #4",
  }),
  automated({
    claim:
      "The exact 0.1.0 archive contains only allowlisted ESM, declarations, maps, metadata, docs, and identical MIT licensing.",
    command: "bun run --cwd packages/nearly-headless-cms package:inspect",
    id: "PKG-001",
    level: "package",
    owner: "library",
    selector: "archive inspection",
    source: "issue #20",
  }),
  automated({
    claim:
      "The same archive installs, typechecks, and runs every import under Bun and portable imports under Node.",
    command: "bun run --cwd packages/nearly-headless-cms package:smoke",
    id: "PKG-002",
    level: "package",
    owner: "library",
    selector: "clean consumer",
    source: "issue #20",
  }),
  automated({
    claim:
      "Portable entry points contain no Bun-only import or declaration while the filesystem subpath is explicit.",
    command: "bun run check:architecture",
    id: "COMP-001",
    level: "architecture",
    owner: "library",
    selector: "runtime isolation",
    source: "issue #20",
  }),
  automated({
    claim:
      "Private workspaces preserve the library → CMS → HTTP-only Content Client dependency direction.",
    command: "bun run check:architecture",
    id: "ARCH-001",
    level: "architecture",
    owner: "cross-system",
    selector: "workspace topology",
    source: "issue #14",
  }),
];
