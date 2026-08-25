import { afterAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
// oxlint-disable-next-line effecttsgo/node-builtin-import -- [EH-210] Baseline paths are test-runner setup paths; there is no Effect runtime involved in this Bun test.
import { join } from "node:path";

let acceptanceTest = test.skip;
if (Bun.env["ACCEPTANCE_SERVERS_READY"] === "1") {
  acceptanceTest = test;
}
const baselineDirectory = join(import.meta.dir, "baselines"),
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-061] screenshot and filesystem APIs are Promise-based Bun platform operations.
  captureAndCheckBaseline = async <View extends Bun.WebView>(
    view: Readonly<View>,
    pageName: string,
    viewport: { readonly height: number; readonly width: number },
  ): Promise<void> => {
    const baselinePath = join(
        baselineDirectory,
        `${pageName}-${viewport.width}x${viewport.height}.png`,
      ),
      screenshotBuffer = await view.screenshot({ encoding: "buffer" }),
      screenshotBytes = new Uint8Array(screenshotBuffer);
    if (updateBaselines) {
      await Bun.write(baselinePath, screenshotBytes);
      return;
    }
    if (!(await Bun.file(baselinePath).exists())) {
      throw new Error(`Visual baseline is missing: ${baselinePath}`);
    }
    await compareToBaseline(screenshotBytes, baselinePath);
  },
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-004] baseline bytes are read through Promise-based Bun filesystem APIs.
  compareToBaseline = async <Bytes extends Uint8Array>(
    screenshotBytes: Readonly<Bytes>,
    baselinePath: string,
  ): Promise<void> => {
    const baselineBytes = new Uint8Array(await Bun.file(baselinePath).arrayBuffer());
    expect(digest(screenshotBytes), `Visual mismatch for ${baselinePath}`).toBe(
      digest(baselineBytes),
    );
  },
  digest = <Bytes extends Uint8Array>(bytes: Readonly<Bytes>): string =>
    createHash("sha256").update(bytes).digest("hex"),
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
  screenshotWaitMilliseconds = 50,
  settleTimeoutMilliseconds = 15_000,
  testTimeoutMilliseconds = 60_000,
  updateBaselines = Bun.env["UPDATE_VISUALS"] === "1",
  viewports = [
    { height: 844, width: 390 },
    { height: 1024, width: 768 },
    { height: 1000, width: 1440 },
  ] as const,
  waitUntilReady = <View extends Bun.WebView>(
    view: Readonly<View>,
    expression: string,
  ): Promise<void> => {
    const deadline = performance.now() + settleTimeoutMilliseconds,
      // oxlint-disable-next-line effecttsgo/async-function -- [EH-008] Bun WebView evaluation and sleep are Promise-based platform lifecycle operations.
      poll = async (): Promise<void> => {
        if (performance.now() >= deadline) {
          throw new Error(`Visual page did not settle: ${expression}`);
        }
        if (await view.evaluate<boolean>(expression)) {
          await view.evaluate(
            "document.fonts.ready.then(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)))))",
          );
          return;
        }
        await Bun.sleep(screenshotWaitMilliseconds);
        return poll();
      };
    return poll();
  };

afterAll(() => {
  Bun.WebView.closeAll();
});

describe("responsive visual baselines", () => {
  for (const page of pages) {
    for (const viewport of viewports) {
      acceptanceTest(
        `${page.name} at ${viewport.width}×${viewport.height}`,
        // oxlint-disable-next-line effecttsgo/async-function -- [EH-009] Bun's test runner requires a Promise-returning lifecycle callback.
        async () => {
          const view = new Bun.WebView({ height: viewport.height, width: viewport.width });
          try {
            await view.navigate(page.url);
            await waitUntilReady(view, page.ready);
            await captureAndCheckBaseline(view, page.name, viewport);
          } finally {
            view.close();
          }
        },
        testTimeoutMilliseconds,
      );
    }
  }
});
