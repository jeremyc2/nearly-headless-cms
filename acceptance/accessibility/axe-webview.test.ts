import {
  type AxePageDefinition,
  type AxeScanResult,
  axeFindingAllowlist,
  axePages,
  startAxeScriptServer,
} from "./axe-webview-support.ts";
import { afterAll, describe, expect, test } from "bun:test";

// oxlint-disable-next-line eslint/init-declarations -- [EH-314] axe script server starts lazily when acceptance servers are ready.
let axeScriptServer: ReturnType<typeof startAxeScriptServer>;

const acceptanceTest = ((): typeof test => {
    if (Bun.env["ACCEPTANCE_SERVERS_READY"] === "1") {
      return test;
    }
    return test.skip;
  })(),
  assertDocumentedAxeFindings = (
    findings: readonly { readonly help: string; readonly id: string }[],
    kind: "incomplete" | "violation",
    page: AxePageDefinition,
  ): void => {
    const unresolvedFindings = findings.filter(
      (finding) =>
        !axeFindingAllowlist.resolvedFindings.some(
          (allowed) =>
            allowed.id === finding.id &&
            allowed.kinds.includes(kind) &&
            allowed.pages.includes(page.name),
        ),
    );
    expect(
      unresolvedFindings,
      `Undocumented axe ${kind}s on ${page.name}: ${unresolvedFindings.map((finding) => `${finding.id} (${finding.help})`).join("; ")}`,
    ).toEqual([]);
  },
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-311] axe acceptance scans compose awaited WebView navigation and evaluation.
  assertIncompletesAreAllowlisted = async (
    scriptUrl: string,
    page: AxePageDefinition,
  ): Promise<void> => {
    const view = new Bun.WebView({ height: viewport.height, width: viewport.width });
    try {
      await view.navigate(page.url);
      await waitUntilPageReady(view, page.ready);
      const scanResult = await runAxeScan(view, scriptUrl);
      assertDocumentedAxeFindings(scanResult.incomplete, "incomplete", page);
    } finally {
      view.close();
    }
  },
  axeScriptUrl = (): string => {
    axeScriptServer ??= startAxeScriptServer();
    return axeScriptServer.scriptUrl;
  },
  pollIntervalMilliseconds = 50,
  registerAxePageTests = (page: AxePageDefinition): void => {
    acceptanceTest(
      `reports no WCAG violations on ${page.name}`,
      // oxlint-disable-next-line effecttsgo/async-function -- [EH-009] Bun's test runner requires a Promise-returning lifecycle callback.
      async () => {
        await scanPageForViolations(axeScriptUrl(), page);
      },
      testTimeoutMilliseconds,
    );
    acceptanceTest(
      `documents axe incompletes on ${page.name}`,
      // oxlint-disable-next-line effecttsgo/async-function -- [EH-009] Bun's test runner requires a Promise-returning lifecycle callback.
      async () => {
        await assertIncompletesAreAllowlisted(axeScriptUrl(), page);
      },
      testTimeoutMilliseconds,
    );
  },
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-311] axe acceptance scans compose awaited WebView navigation and evaluation.
  runAxeScan = async <View extends Bun.WebView>(
    view: Readonly<View>,
    scriptUrl: string,
  ): Promise<AxeScanResult> => {
    await view.evaluate<string>(
      `(async () => {
      if (window.__axeLoaded) {
        return "ready";
      }
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = ${JSON.stringify(scriptUrl)};
        script.onload = () => {
          window.__axeLoaded = true;
          resolve(true);
        };
        script.onerror = () => reject(new Error("Failed to load axe-core"));
        document.head.appendChild(script);
      });
      return "loaded";
    })()`,
    );
    return view.evaluate<AxeScanResult>(
      `new Promise((resolve, reject) => {
      window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } }, (error, results) => {
        if (error) {
          reject(error);
          return;
        }
        resolve({
          incomplete: results.incomplete.map((entry) => ({ id: entry.id, help: entry.help })),
          url: results.url,
          violations: results.violations.map((entry) => ({ id: entry.id, help: entry.help })),
        });
      });
    })`,
    );
  },
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-311] axe acceptance scans compose awaited WebView navigation and evaluation.
  scanPageForViolations = async (
    scriptUrl: string,
    page: AxePageDefinition,
  ): Promise<void> => {
    const view = new Bun.WebView({ height: viewport.height, width: viewport.width });
    try {
      await view.navigate(page.url);
      await waitUntilPageReady(view, page.ready);
      const scanResult = await runAxeScan(view, scriptUrl);
      assertDocumentedAxeFindings(scanResult.violations, "violation", page);
    } finally {
      view.close();
    }
  },
  settleTimeoutMilliseconds = 15_000,
  testTimeoutMilliseconds = 120_000,
  viewport = { height: 1000, width: 1440 },
  waitUntilPageReady = <View extends Bun.WebView>(
    view: Readonly<View>,
    expression: string,
  ): Promise<void> => {
    const deadline = performance.now() + settleTimeoutMilliseconds,
      // oxlint-disable-next-line effecttsgo/async-function -- [EH-312] WebView readiness polling composes awaited evaluation and sleep.
      poll = async (): Promise<void> => {
        if (performance.now() >= deadline) {
          throw new Error(`Accessibility page did not settle: ${expression}`);
        }
        if (await view.evaluate<boolean>(expression)) {
          await view.evaluate(
            "document.fonts.ready.then(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)))))",
          );
          return;
        }
        await Bun.sleep(pollIntervalMilliseconds);
        return poll();
      };
    return poll();
  };

afterAll(() => {
  axeScriptServer?.close();
  Bun.WebView.closeAll();
});

describe("axe-core accessibility", () => {
  for (const page of axePages) {
    registerAxePageTests(page);
  }
});
