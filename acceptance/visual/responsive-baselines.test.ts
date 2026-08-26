import { afterAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
// oxlint-disable-next-line effecttsgo/node-builtin-import -- [EH-210] Baseline paths are test-runner setup paths; there is no Effect runtime involved in this Bun test.
import { join } from "node:path";
import { visualBaselineScenarios } from "./visual-baseline-scenario-registry.ts";

let acceptanceTest = test.skip;
if (Bun.env["ACCEPTANCE_SERVERS_READY"] === "1") {
  acceptanceTest = test;
}
interface IconAlignmentMeasurement {
  readonly horizontalOffset: number;
  readonly symbol: string | null;
  readonly verticalOffset: number;
}

interface OrbitArrowMeasurement {
  readonly arrowheadContent: string;
  readonly arrowheadHeight: string;
  readonly arrowheadTop: number;
  readonly arrowheadTransform: string;
  readonly arrowheadWidth: string;
  readonly borderRightWidth: string;
  readonly borderTopWidth: string;
  readonly connectorHeight: number;
}

const alignmentTolerancePixels = 1,
  assertBuildOrbitArrowIsCentered = <View extends Bun.WebView>(
    view: Readonly<View>,
  ): Promise<void> =>
    view
      .evaluate<OrbitArrowMeasurement | null>(`(() => {
        const connector = document.querySelector(".build-orbit i");
        if (!(connector instanceof HTMLElement)) {
          return null;
        }
        const connectorStyle = getComputedStyle(connector);
        const arrowheadStyle = getComputedStyle(connector, "::after");
        return {
          arrowheadContent: arrowheadStyle.content,
          arrowheadHeight: arrowheadStyle.height,
          arrowheadTop: Number.parseFloat(arrowheadStyle.top),
          arrowheadTransform: arrowheadStyle.transform,
          arrowheadWidth: arrowheadStyle.width,
          borderRightWidth: arrowheadStyle.borderRightWidth,
          borderTopWidth: arrowheadStyle.borderTopWidth,
          connectorHeight: Number.parseFloat(connectorStyle.height),
        };
      })()`)
      .then((measurement) => {
        if (measurement === null) {
          return;
        }
        expect(measurement.arrowheadContent).toBe('""');
        expect(measurement.arrowheadHeight).toBe(measurement.arrowheadWidth);
        expect(measurement.arrowheadTop).toBe(measurement.connectorHeight / centerDivisor);
        expect(measurement.borderRightWidth).toBe(`${measurement.connectorHeight}px`);
        expect(measurement.borderTopWidth).toBe(`${measurement.connectorHeight}px`);
        expect(measurement.arrowheadTransform).not.toBe("none");
      }),
  assertSignalIconsAreCentered = <View extends Bun.WebView>(
    view: Readonly<View>,
  ): Promise<void> =>
    view
      .evaluate<readonly IconAlignmentMeasurement[]>(`Array.from(
        document.querySelectorAll(".signal-icon"),
        element => {
          const containerBounds = element.getBoundingClientRect();
          const symbolRange = document.createRange();
          symbolRange.selectNodeContents(element);
          const symbolBounds = symbolRange.getBoundingClientRect();
          return {
            horizontalOffset:
              ((symbolBounds.left + symbolBounds.right) -
                (containerBounds.left + containerBounds.right)) /
              2,
            symbol: element.textContent,
            verticalOffset:
              ((symbolBounds.top + symbolBounds.bottom) -
                (containerBounds.top + containerBounds.bottom)) /
              2,
          };
        },
      )`)
      .then((measurements) => {
        for (const measurement of measurements) {
          expect(
            Math.abs(measurement.horizontalOffset),
            `Signal icon ${measurement.symbol ?? ""} is not horizontally centered`,
          ).toBeLessThanOrEqual(alignmentTolerancePixels);
          expect(
            Math.abs(measurement.verticalOffset),
            `Signal icon ${measurement.symbol ?? ""} is not vertically centered`,
          ).toBeLessThanOrEqual(alignmentTolerancePixels);
        }
      }),
  baselineDirectory = join(import.meta.dir, "baselines"),
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
  centerDivisor = 2,
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
  screenshotWaitMilliseconds = 50,
  settleTimeoutMilliseconds = 15_000,
  testTimeoutMilliseconds = 120_000,
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
  for (const scenario of visualBaselineScenarios) {
    for (const viewport of viewports) {
      acceptanceTest(
        `${scenario.name} at ${viewport.width}×${viewport.height}`,
        // oxlint-disable-next-line effecttsgo/async-function -- [EH-009] Bun's test runner requires a Promise-returning lifecycle callback.
        async () => {
          const view = new Bun.WebView({ height: viewport.height, width: viewport.width });
          try {
            await scenario.prepare(view);
            await waitUntilReady(view, scenario.ready);
            if (scenario.finalize !== undefined) {
              await scenario.finalize(view);
            }
            await assertBuildOrbitArrowIsCentered(view);
            await assertSignalIconsAreCentered(view);
            await captureAndCheckBaseline(view, scenario.name, viewport);
          } finally {
            view.close();
          }
        },
        testTimeoutMilliseconds,
      );
    }
  }
});
