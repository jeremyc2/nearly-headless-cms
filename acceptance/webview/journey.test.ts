import { afterAll, describe, expect, test } from "bun:test";

const EXPECTED_SIGNAL_CARD_COUNT = 4,
  MINIMUM_ENTRY_ROW_COUNT = 2,
  POLLING_INTERVAL_MILLISECONDS = 50,
  PUBLIC_BLOG_HEIGHT = 844,
  PUBLIC_BLOG_WIDTH = 390,
  RESPONSIVE_HEIGHT = 844,
  RESPONSIVE_WIDTH = 390,
  WAIT_TIMEOUT_MILLISECONDS = 15_000,
  acceptanceTest = ((): typeof test => {
    if (Bun.env["ACCEPTANCE_SERVERS_READY"] === "1") {
      return test;
    }
    return test.skip;
  })(),
  // oxlint-disable-next-line effecttsgo/async-function -- journey assertions compose awaited WebView navigation and evaluation.
  assertCmsHomePage = async (view: Bun.WebView): Promise<void> => {
    await view.navigate("http://localhost:3000/");
    await waitFor(
      view,
      "document.querySelectorAll('.signal-card').length",
      (value: number) => value === EXPECTED_SIGNAL_CARD_COUNT,
    );
    expect(
      await view.evaluate<{ heading: number; main: number; navigation: number }>(
        "({ main: document.querySelectorAll('main').length, navigation: document.querySelectorAll('nav').length, heading: document.querySelectorAll('h1').length })",
      ),
    ).toEqual({ heading: 1, main: 1, navigation: 1 });
  },
  // oxlint-disable-next-line effecttsgo/async-function -- journey assertions compose awaited WebView navigation and evaluation.
  assertContentListAndFilter = async (view: Bun.WebView): Promise<void> => {
    await view.click('a[href="/content/post"]');
    await waitFor(
      view,
      "document.querySelectorAll('.entry-row').length",
      (value: number) => value >= MINIMUM_ENTRY_ROW_COUNT,
    );
    await view.evaluate(
      "(() => { const input = document.querySelector('input[placeholder^=\"Filter\"]'); window.__lastInputWasTrusted = false; input?.addEventListener('input', event => { window.__lastInputWasTrusted = event.isTrusted }, { once: true }); return true })()",
    );
    await view.click('input[placeholder^="Filter"]');
    await view.type("lighthouse");
    expect(await view.evaluate<boolean>("window.__lastInputWasTrusted")).toBeTrue();
    expect(
      await view.evaluate<string | undefined>(
        "document.querySelector('input[placeholder^=\"Filter\"]')?.value",
      ),
    ).toBe("lighthouse");
  },
  // oxlint-disable-next-line effecttsgo/async-function -- journey assertions compose awaited WebView navigation and evaluation.
  assertEditorHistoryNavigation = async (view: Bun.WebView): Promise<string> => {
    await view.click(".entry-row");
    await waitFor(view, "location.pathname", (value: string) => value.split("/").length > 3);
    const editorPath = await view.evaluate<string>("location.pathname");
    await view.evaluate("(() => { history.back(); return true })()");
    expect(
      await waitFor(view, "location.pathname", (value: string) => value === "/content/post"),
    ).toBe("/content/post");
    await view.evaluate("(() => { history.forward(); return true })()");
    expect(
      await waitFor(view, "location.pathname", (value: string) => value === editorPath),
    ).toBe(editorPath);
    return editorPath;
  },
  // oxlint-disable-next-line effecttsgo/async-function -- journey assertions compose awaited WebView navigation and evaluation.
  assertPublicBlogPage = async (view: Bun.WebView): Promise<void> => {
    await view.navigate("http://localhost:4321/posts/a-lighthouse-for-content/");
    expect(
      await waitFor(
        view,
        "document.querySelector('h1')?.textContent",
        (value: string | undefined) => value === "A Lighthouse for Content",
      ),
    ).toBe("A Lighthouse for Content");
    expect(
      await view.evaluate<{
        article: number;
        labelledErrors: number;
        liveRegions: number;
        main: number;
      }>(
        "({ main: document.querySelectorAll('main').length, article: document.querySelectorAll('article').length, liveRegions: document.querySelectorAll('[aria-live]').length, labelledErrors: document.querySelectorAll('[aria-describedby]').length })",
      ),
    ).toEqual({ article: 2, labelledErrors: 3, liveRegions: 1, main: 1 });
    await view.evaluate(
      "(() => { const input = document.querySelector('input[name=displayName]'); window.__commentInputWasTrusted = false; input?.addEventListener('input', event => { window.__commentInputWasTrusted = event.isTrusted }, { once: true }); return true })()",
    );
    await view.scrollTo("input[name=displayName]", { block: "center" });
    await view.click("input[name=displayName]");
    await view.type("WebView Reader");
    expect(await view.evaluate<boolean>("window.__commentInputWasTrusted")).toBeTrue();
  },
  // oxlint-disable-next-line effecttsgo/async-function -- journey assertions compose awaited WebView navigation and evaluation.
  assertResponsiveEditor = async (view: Bun.WebView, editorPath: string): Promise<void> => {
    await view.navigate(`http://localhost:3000${editorPath}`);
    expect(
      await waitFor(
        view,
        "document.querySelector('h1')?.textContent",
        (value: string | undefined) => value === "A Lighthouse for Content",
      ),
    ).toBe("A Lighthouse for Content");
    await view.resize(RESPONSIVE_WIDTH, RESPONSIVE_HEIGHT);
    expect(await view.evaluate<number>("innerWidth")).toBe(RESPONSIVE_WIDTH);
  },
  createWebView = (
    consoleErrors: unknown[],
    height: number,
    width: number,
  ): Bun.WebView =>
    new Bun.WebView({
      console: (method, ...values) => {
        if (method === "error") {
          consoleErrors.push(...values);
        }
      },
      height,
      width,
    }),
  // oxlint-disable-next-line effecttsgo/async-function -- journey orchestration composes native WebView Promise operations.
  runCmsJourneyPhase = async (
    consoleErrors: unknown[],
  ): Promise<{ editorPath: string; view: Bun.WebView }> => {
    let view = createWebView(consoleErrors, 1000, 1440);
    await assertCmsHomePage(view);
    await assertContentListAndFilter(view);
    const editorPath = await assertEditorHistoryNavigation(view);
    view.close();
    view = createWebView(consoleErrors, 1000, 1440);
    await assertResponsiveEditor(view, editorPath);
    return { editorPath, view };
  },
  // oxlint-disable-next-line effecttsgo/async-function -- journey orchestration composes native WebView Promise operations.
  runCompleteSystemJourney = async (): Promise<void> => {
    const accumulatedErrors: unknown[] = [],
      cmsJourney = await runCmsJourneyPhase(accumulatedErrors);
    let {view} = cmsJourney;
    try {
      view.close();
      view = createWebView(accumulatedErrors, PUBLIC_BLOG_HEIGHT, PUBLIC_BLOG_WIDTH);
      await assertPublicBlogPage(view);
      expect(accumulatedErrors).toEqual([]);
    } finally {
      view.close();
    }
  },
  waitFor = <Value>(
    view: Bun.WebView,
    expression: string,
    predicate: (value: Value) => boolean,
  ): Promise<Value> => {
    const deadline = performance.now() + WAIT_TIMEOUT_MILLISECONDS,
      // oxlint-disable-next-line effecttsgo/async-function -- Bun WebView evaluation and sleep are Promise-based platform lifecycle operations.
      poll = async (): Promise<Value> => {
        if (performance.now() >= deadline) {
          throw new Error(`WebView condition timed out: ${expression}`);
        }
        const value = await view.evaluate<Value>(expression);
        if (predicate(value)) {
          return value;
        }
        await Bun.sleep(POLLING_INTERVAL_MILLISECONDS);
        return poll();
      };
    return poll();
  };

afterAll(() => {
  Bun.WebView.closeAll();
});

describe("complete-system WebView journey", () => {
  acceptanceTest(
    "uses trusted input, responsive layout, history navigation, and semantic page structure",
    // oxlint-disable-next-line effecttsgo/async-function -- Bun's test runner requires a Promise-returning lifecycle callback.
    async () => {
      await runCompleteSystemJourney();
    },
    120_000,
  );
});
