import { afterAll, describe, expect, test } from "bun:test";

const CMS_VIEWPORT_HEIGHT = 1000,
  CMS_VIEWPORT_WIDTH = 1440,
  CONTENT_LIST_READY =
    "document.querySelector('h1')?.textContent === 'Posts' && document.querySelectorAll('.entry-row').length >= 2",
  EXPECTED_SIGNAL_CARD_COUNT = 4,
  JOURNEY_TEST_TIMEOUT_MILLISECONDS = 120_000,
  MINIMUM_EDITOR_PATH_SEGMENTS = 4,
  OVERVIEW_READY = `document.querySelectorAll('.signal-card').length === ${EXPECTED_SIGNAL_CARD_COUNT}`,
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
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-041] journey assertions compose awaited WebView navigation and evaluation.
  assertCmsHomePage = async <View extends Bun.WebView>(view: Readonly<View>): Promise<void> => {
    await view.navigate("http://localhost:3000/");
    await waitUntilReady(view, OVERVIEW_READY);
    expect(
      await view.evaluate<{ heading: number; main: number; navigation: number }>(
        "({ main: document.querySelectorAll('main').length, navigation: document.querySelectorAll('nav').length, heading: document.querySelectorAll('h1').length })",
      ),
    ).toEqual({ heading: 1, main: 1, navigation: 1 });
  },
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-041] journey assertions compose awaited WebView navigation and evaluation.
  assertContentList = async <View extends Bun.WebView>(view: Readonly<View>): Promise<void> => {
    await view.navigate("http://localhost:3000/content/post");
    await waitUntilReady(view, CONTENT_LIST_READY);
  },
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-041] journey assertions compose awaited WebView navigation and evaluation.
  assertEditorHistoryNavigation = async <View extends Bun.WebView>(
    view: Readonly<View>,
  ): Promise<{ editorPath: string; editorTitle: string }> => {
    await waitUntilReady(view, "document.querySelectorAll('.entry-list .entry-row').length >= 1");
    await view.scrollTo(".entry-list .entry-row", { block: "center" });
    await view.click(".entry-list .entry-row");
    await waitFor(
      view,
      "location.pathname",
      (value: string) => value.split("/").length >= MINIMUM_EDITOR_PATH_SEGMENTS,
    );
    const editorPath = await view.evaluate<string>("location.pathname"),
      editorTitle = requireNonEmptyString(
        await waitFor(
          view,
          "document.querySelector('h1')?.textContent",
          (value: string | undefined) => value !== undefined && value.length > 0,
        ),
      );
    await view.evaluate("(() => { history.back(); return true })()");
    expect(
      await waitFor(view, "location.pathname", (value: string) => value === "/content/post"),
    ).toBe("/content/post");
    await view.evaluate("(() => { history.forward(); return true })()");
    expect(await waitFor(view, "location.pathname", (value: string) => value === editorPath)).toBe(
      editorPath,
    );
    return { editorPath, editorTitle };
  },
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-041] journey assertions compose awaited WebView navigation and evaluation.
  assertPublicBlogPage = async <View extends Bun.WebView>(view: Readonly<View>): Promise<void> => {
    await view.navigate("http://localhost:4321/posts/a-lighthouse-for-content/");
    await waitUntilReady(
      view,
      "document.querySelector('h1')?.textContent === 'A Lighthouse for Content'",
    );
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
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-041] journey assertions compose awaited WebView navigation and evaluation.
  assertResponsiveEditor = async <View extends Bun.WebView>(
    view: Readonly<View>,
    editorPath: string,
    editorTitle: string,
  ): Promise<void> => {
    await view.navigate(`http://localhost:3000${editorPath}`);
    await waitUntilReady(
      view,
      `document.querySelector('h1')?.textContent === ${JSON.stringify(editorTitle)}`,
    );
    await view.resize(RESPONSIVE_WIDTH, RESPONSIVE_HEIGHT);
    expect(await view.evaluate<number>("innerWidth")).toBe(RESPONSIVE_WIDTH);
  },
  createWebView = <Input extends { readonly errors: unknown[] }>(
    consoleErrors: Readonly<Input>,
    height: number,
    width: number,
  ): Bun.WebView =>
    new Bun.WebView({
      console: (method, ...values) => {
        if (method === "error") {
          consoleErrors.errors.push(...values);
        }
      },
      height,
      width,
    }),
  requireNonEmptyString = (value: string | undefined): string => {
    if (value === undefined || value.length === 0) {
      throw new Error("Expected a non-empty string from WebView evaluation");
    }
    return value;
  },
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-042] journey orchestration composes native WebView Promise operations.
  runCmsContentPhase = async <Input extends { readonly errors: unknown[] }>(
    consoleErrors: Readonly<Input>,
  ): Promise<{ editorPath: string; editorTitle: string }> => {
    const contentListView = createWebView(consoleErrors, CMS_VIEWPORT_HEIGHT, CMS_VIEWPORT_WIDTH);
    try {
      await assertContentList(contentListView);
      return await assertEditorHistoryNavigation(contentListView);
    } finally {
      contentListView.close();
    }
  },
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-042] journey orchestration composes native WebView Promise operations.
  runCmsOverviewPhase = async <Input extends { readonly errors: unknown[] }>(
    consoleErrors: Readonly<Input>,
  ): Promise<void> => {
    const overviewView = createWebView(consoleErrors, CMS_VIEWPORT_HEIGHT, CMS_VIEWPORT_WIDTH);
    try {
      await assertCmsHomePage(overviewView);
    } finally {
      overviewView.close();
    }
  },
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-043] journey orchestration follows helper dependency order despite alphabetical ordering.
  runCmsJourneyPhase = async <Input extends { readonly errors: unknown[] }>(
    consoleErrors: Readonly<Input>,
  ): Promise<{ editorPath: string; view: Bun.WebView }> => {
    await runCmsOverviewPhase(consoleErrors);
    const { editorPath, editorTitle } = await runCmsContentPhase(consoleErrors),
      responsiveView = createWebView(consoleErrors, CMS_VIEWPORT_HEIGHT, CMS_VIEWPORT_WIDTH);
    await assertResponsiveEditor(responsiveView, editorPath, editorTitle);
    return { editorPath, view: responsiveView };
  },
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-042] journey orchestration composes native WebView Promise operations.
  runCompleteSystemJourney = async (): Promise<void> => {
    const accumulatedErrors = { errors: [] as unknown[] },
      cmsJourney = await runCmsJourneyPhase(accumulatedErrors);
    let { view } = cmsJourney;
    try {
      view.close();
      view = createWebView(accumulatedErrors, PUBLIC_BLOG_HEIGHT, PUBLIC_BLOG_WIDTH);
      await assertPublicBlogPage(view);
      expect(accumulatedErrors.errors).toEqual([]);
    } finally {
      view.close();
    }
  },
  waitFor = <Value, View extends Bun.WebView>(
    view: Readonly<View>,
    expression: string,
    predicate: (value: Value) => boolean,
  ): Promise<Value> => {
    const deadline = performance.now() + WAIT_TIMEOUT_MILLISECONDS,
      // oxlint-disable-next-line effecttsgo/async-function -- [EH-010] Bun WebView evaluation and sleep are Promise-based platform lifecycle operations.
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
  },
  waitUntilReady = <View extends Bun.WebView>(
    view: Readonly<View>,
    expression: string,
  ): Promise<void> => {
    const deadline = performance.now() + WAIT_TIMEOUT_MILLISECONDS,
      // oxlint-disable-next-line effecttsgo/async-function -- [EH-010] Bun WebView evaluation and sleep are Promise-based platform lifecycle operations.
      poll = async (): Promise<void> => {
        if (performance.now() >= deadline) {
          throw new Error(`WebView page did not settle: ${expression}`);
        }
        if (await view.evaluate<boolean>(expression)) {
          await view.evaluate(
            "document.fonts.ready.then(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)))))",
          );
          return;
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
    // oxlint-disable-next-line effecttsgo/async-function -- [EH-011] Bun's test runner requires a Promise-returning lifecycle callback.
    async () => {
      await runCompleteSystemJourney();
    },
    JOURNEY_TEST_TIMEOUT_MILLISECONDS,
  );
});
