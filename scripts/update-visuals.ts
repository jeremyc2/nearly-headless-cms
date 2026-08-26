import { runAcceptanceCommand, withAcceptanceServers } from "./acceptance-servers.ts";

// oxlint-disable-next-line effecttsgo/async-function -- [EH-355] visual baseline update orchestrates sequential CLI commands inside acceptance server lifecycle.
await withAcceptanceServers(async () => {
  await runAcceptanceCommand(["bun", "run", "test:visual"], {
    ACCEPTANCE_SERVERS_READY: "1",
    UPDATE_VISUALS: "1",
  });
});

// oxlint-disable-next-line effecttsgo/global-console -- [EH-351] baseline update completion is intentionally emitted to CLI stdout.
console.log("\nVisual baselines updated in acceptance/visual/baselines/");
