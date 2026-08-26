// oxlint-disable-next-line effecttsgo/node-builtin-import -- [EH-317] fileURLToPath converts Bun module resolution URLs into filesystem paths for axe-core serving.
import { fileURLToPath } from "node:url";
// oxlint-disable-next-line effecttsgo/node-builtin-import -- [EH-313] Accessibility test setup resolves axe-core from node_modules before any Effect application exists.
import { join } from "node:path";

export interface AxeFindingAllowlist {
  readonly resolvedFindings: readonly {
    readonly id: string;
    readonly kinds: readonly ("incomplete" | "violation")[];
    readonly pages: readonly string[];
    readonly reason: string;
  }[];
}

export interface AxePageDefinition {
  readonly name: string;
  readonly ready: string;
  readonly url: string;
}

export interface AxeScanResult {
  readonly incomplete: readonly { readonly help: string; readonly id: string }[];
  readonly url: string;
  readonly violations: readonly { readonly help: string; readonly id: string }[];
}

const axeAllowlistPath = join(import.meta.dir, "axe-incomplete-allowlist.json"),
  axeAllowlistRaw: unknown = await Bun.file(axeAllowlistPath).json(),
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- [EH-316] allowlist JSON is versioned repository fixture data validated at acceptance runtime.
  axeAllowlistValue = axeAllowlistRaw as AxeFindingAllowlist,
  axeModulePath = fileURLToPath(import.meta.resolve("axe-core/axe.min.js")),
  axePagesValue: readonly AxePageDefinition[] = [
    {
      name: "example-cms-overview",
      ready:
        "document.querySelectorAll('.signal-card').length === 4 && document.querySelectorAll('.recent-panel .entry-row').length >= 5",
      url: "http://localhost:3000/",
    },
    {
      name: "example-cms-content-list",
      ready: "document.querySelectorAll('.entry-row').length >= 2",
      url: "http://localhost:3000/content/post",
    },
    {
      name: "public-blog-home",
      ready: "document.querySelectorAll('.post-card').length > 0",
      url: "http://localhost:4321/",
    },
    {
      name: "public-blog-post",
      ready:
        "document.querySelector('h1')?.textContent === 'A Lighthouse for Content' && document.querySelector('input[name=displayName]') !== null",
      url: "http://localhost:4321/posts/a-lighthouse-for-content/",
    },
  ] as const;

// oxlint-disable-next-line eslint/one-var -- [EH-315] exported bindings follow private fixture resolution in the same module.
export const axeFindingAllowlist = axeAllowlistValue,
  axePages = axePagesValue,
  startAxeScriptServer = (): { readonly close: () => void; readonly scriptUrl: string } => {
    const server = Bun.serve({
      fetch(request) {
        if (new URL(request.url).pathname === "/axe.min.js") {
          return new Response(Bun.file(axeModulePath), {
            headers: { "content-type": "application/javascript; charset=utf-8" },
          });
        }
        return new Response("not found", { status: 404 });
      },
      port: 0,
    });
    return {
      close: () => {
        void server.stop(true);
      },
      scriptUrl: `http://127.0.0.1:${server.port}/axe.min.js`,
    };
  };
