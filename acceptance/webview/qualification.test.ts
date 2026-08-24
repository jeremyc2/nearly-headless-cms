import { afterAll, describe, expect, test } from "bun:test";

const ACCEPTANCE_RUN_COUNT = 10,
  ACCEPTANCE_TIMEOUT_MILLISECONDS = 120_000,
  INITIAL_RUN_NUMBER = 1,
  NO_CONSOLE_ERRORS = 0,
  POLLING_INTERVAL_MILLISECONDS = 50,
  RUN_NUMBER_INCREMENT = 1,
  WAIT_TIMEOUT_MILLISECONDS = 15_000,
  ZERO = 0,
  enabled = Bun.env["ACCEPTANCE_SERVERS_READY"] === "1",
  waitFor = async <Value>(
    view: Bun.WebView,
    expression: string,
    predicate: (value: Value) => boolean,
  ): Promise<Value> => {
    const deadline = Date.now() + WAIT_TIMEOUT_MILLISECONDS;
    while (Date.now() < deadline) {
      const value = await view.evaluate<Value>(expression);
      if (predicate(value)) {
        return value;
      }
      await Bun.sleep(POLLING_INTERVAL_MILLISECONDS);
    }
    throw new Error(`WebView condition timed out: ${expression}`);
  },

 selectAcceptanceTest = (enabledRun: boolean): typeof test => {
  if (enabledRun) {
    return test;
  }
  return test.skip;
};

afterAll(() => {
  Bun.WebView.closeAll();
});

describe("Bun WebView qualification", () => {
  selectAcceptanceTest(enabled)(
    "completes ten consecutive native WebKit lifecycle runs without a retry",
    async () => {
      for (
        let runNumber = INITIAL_RUN_NUMBER;
        runNumber <= ACCEPTANCE_RUN_COUNT;
        runNumber += RUN_NUMBER_INCREMENT
      ) {
        const consoleErrors: unknown[] = [],
          view = new Bun.WebView({
            console: (method, ...values) => {
              if (method === "error") {consoleErrors.push(...values);}
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
          expect(consoleErrors).toHaveLength(NO_CONSOLE_ERRORS);
        } finally {
          view.close();
        }
        expect(runNumber).toBeGreaterThan(ZERO);
      }
    },
    ACCEPTANCE_TIMEOUT_MILLISECONDS,
  );
});
