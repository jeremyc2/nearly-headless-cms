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
    // oxlint-disable-next-line effecttsgo/async-function -- Bun's test runner requires a Promise-returning lifecycle callback.
    async () => {
      // oxlint-disable-next-line effecttsgo/async-function -- recursive acceptance retries compose native WebView Promise operations.
      const runQualification = async (runNumber: number): Promise<void> => {
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
        if (runNumber < ACCEPTANCE_RUN_COUNT) {
          return runQualification(runNumber + RUN_NUMBER_INCREMENT);
        }
      };
      await runQualification(INITIAL_RUN_NUMBER);
    },
    ACCEPTANCE_TIMEOUT_MILLISECONDS,
  );
});
