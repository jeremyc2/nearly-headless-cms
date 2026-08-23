import { afterAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { join } from "node:path";

const enabled = Bun.env["ACCEPTANCE_SERVERS_READY"] === "1",
  acceptanceTest = enabled ? test : test.skip,
  updateBaselines = Bun.env["UPDATE_VISUALS"] === "1",
  baselineDirectory = join(import.meta.dir, "baselines"),
  viewports = [
    { height: 844, width: 390 },
    { height: 1_024, width: 768 },
    { height: 1_000, width: 1_440 },
  ] as const,
  pages = [
    {
      name: "example-cms-overview",
      ready: "document.querySelectorAll('.signal-card').length === 4",
      url: "http://localhost:3000/",
    },
    {
      name: "public-blog-home",
      ready: "document.querySelectorAll('.post-card').length > 0",
      url: "http://localhost:4321/",
    },
  ] as const,
  waitUntilReady = async (view: Bun.WebView, expression: string): Promise<void> => {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      if (await view.evaluate<boolean>(expression)) {
        await view.evaluate(
          "document.fonts.ready.then(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)))))",
        );
        return;
      }
      await Bun.sleep(50);
    }
    throw new Error(`Visual page did not settle: ${expression}`);
  },
  digest = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

afterAll(() => {
  Bun.WebView.closeAll();
});

describe("responsive visual baselines", () => {
  for (const page of pages) {
    for (const viewport of viewports) {
      acceptanceTest(
        `${page.name} at ${viewport.width}×${viewport.height}`,
        async () => {
          const view = new Bun.WebView({ height: viewport.height, width: viewport.width });
          try {
            await view.navigate(page.url);
            await waitUntilReady(view, page.ready);
            const screenshot = new Uint8Array(await view.screenshot({ encoding: "buffer" })),
              baselinePath = join(
                baselineDirectory,
                `${page.name}-${viewport.width}x${viewport.height}.png`,
              );
            if (updateBaselines) {
              await Bun.write(baselinePath, screenshot);
              return;
            }
            if (!(await Bun.file(baselinePath).exists())) {
              throw new Error(`Visual baseline is missing: ${baselinePath}`);
            }
            const baseline = new Uint8Array(await Bun.file(baselinePath).arrayBuffer());
            expect(digest(screenshot), `Visual mismatch for ${baselinePath}`).toBe(
              digest(baseline),
            );
          } finally {
            view.close();
          }
        },
        60_000,
      );
    }
  }
});
