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
      if (predicate(value)) {
        return value;
      }
      await Bun.sleep(50);
    }
    throw new Error(`WebView condition timed out: ${expression}`);
  };

afterAll(() => {
  Bun.WebView.closeAll();
});

describe("Bun WebView qualification", () => {
  acceptanceTest(
    "completes ten consecutive native WebKit lifecycle runs without a retry",
    async () => {
      for (let runNumber = 1; runNumber <= 10; runNumber += 1) {
        const consoleErrors: unknown[] = [],
          view = new Bun.WebView({
            console: (method, ...values) => {
              if (method === "error") consoleErrors.push(...values);
            },
            height: 600,
            width: 800,
          });
        try {
          await view.navigate("http://localhost:3000/");
          const heading = await waitFor<string | undefined>(
            view,
            "document.querySelector('h1')?.textContent",
            (value) => value === "Good afternoon",
          );
          expect(heading).toBe("Good afternoon");
          expect(await view.evaluate("fetch('/health').then(response => response.text())")).toBe(
            "ok",
          );
          expect(consoleErrors).toEqual([]);
        } finally {
          view.close();
        }
        expect(runNumber).toBeGreaterThan(0);
      }
    },
    120_000,
  );
});
