import { afterAll, describe, expect, test } from "bun:test";

const enabled = Bun.env["ACCEPTANCE_SERVERS_READY"] === "1",
  acceptanceTest = enabled ? test : test.skip,
  waitFor = async <Value>(
    view: Bun.WebView,
    expression: string,
    predicate: (value: Value) => boolean,
  ): Promise<Value> => {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      const value = await view.evaluate<Value>(expression);
      if (predicate(value)) return value;
      await Bun.sleep(50);
    }
    throw new Error(`WebView condition timed out: ${expression}`);
  };

afterAll(() => Bun.WebView.closeAll());

describe("complete-system WebView journey", () => {
  acceptanceTest(
    "uses trusted input, responsive layout, history navigation, and semantic page structure",
    async () => {
      const consoleErrors: unknown[] = [];
      let view = new Bun.WebView({
        console: (method, ...values) => {
          if (method === "error") consoleErrors.push(...values);
        },
        height: 1_000,
        width: 1_440,
      });
      try {
        await view.navigate("http://localhost:3000/");
        await waitFor(
          view,
          "document.querySelectorAll('.signal-card').length",
          (value: number) => value === 4,
        );
        expect(
          await view.evaluate(
            "({ main: document.querySelectorAll('main').length, navigation: document.querySelectorAll('nav').length, heading: document.querySelectorAll('h1').length })",
          ),
        ).toEqual({ heading: 1, main: 1, navigation: 1 });
        await view.click('a[href="/content/post"]');
        await waitFor(
          view,
          "document.querySelectorAll('.entry-row').length",
          (value: number) => value >= 2,
        );
        await view.evaluate(
          "(() => { const input = document.querySelector('input[placeholder^=\"Filter\"]'); window.__lastInputWasTrusted = false; input?.addEventListener('input', event => { window.__lastInputWasTrusted = event.isTrusted }, { once: true }); return true })()",
        );
        await view.click('input[placeholder^="Filter"]');
        await view.type("lighthouse");
        expect(await view.evaluate("window.__lastInputWasTrusted")).toBeTrue();
        expect(
          await view.evaluate("document.querySelector('input[placeholder^=\"Filter\"]')?.value"),
        ).toBe("lighthouse");
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
        view.close();
        view = new Bun.WebView({
          console: (method, ...values) => {
            if (method === "error") consoleErrors.push(...values);
          },
          height: 1_000,
          width: 1_440,
        });
        await view.navigate(`http://localhost:3000${editorPath}`);
        expect(
          await waitFor(
            view,
            "document.querySelector('h1')?.textContent",
            (value: string | undefined) => value === "A Lighthouse for Content",
          ),
        ).toBe("A Lighthouse for Content");
        await view.resize(390, 844);
        expect(await view.evaluate("innerWidth")).toBe(390);

        // Bun WebView native interaction promises remain pending after a Back/Forward traversal.
        // A fresh view also reflects that the CMS and Public Blog are separately runnable apps.
        view.close();
        view = new Bun.WebView({
          console: (method, ...values) => {
            if (method === "error") consoleErrors.push(...values);
          },
          height: 844,
          width: 390,
        });
        await view.navigate("http://localhost:4321/posts/a-lighthouse-for-content/");
        expect(
          await waitFor(
            view,
            "document.querySelector('h1')?.textContent",
            (value: string | undefined) => value === "A Lighthouse for Content",
          ),
        ).toBe("A Lighthouse for Content");
        expect(
          await view.evaluate(
            "({ main: document.querySelectorAll('main').length, article: document.querySelectorAll('article').length, liveRegions: document.querySelectorAll('[aria-live]').length, labelledErrors: document.querySelectorAll('[aria-describedby]').length })",
          ),
        ).toEqual({ article: 2, labelledErrors: 3, liveRegions: 1, main: 1 });
        await view.evaluate(
          "(() => { const input = document.querySelector('input[name=displayName]'); window.__commentInputWasTrusted = false; input?.addEventListener('input', event => { window.__commentInputWasTrusted = event.isTrusted }, { once: true }); return true })()",
        );
        await view.scrollTo("input[name=displayName]", { block: "center" });
        await view.click("input[name=displayName]");
        await view.type("WebView Reader");
        expect(await view.evaluate("window.__commentInputWasTrusted")).toBeTrue();
        expect(consoleErrors).toEqual([]);
      } finally {
        view.close();
      }
    },
    120_000,
  );
});
