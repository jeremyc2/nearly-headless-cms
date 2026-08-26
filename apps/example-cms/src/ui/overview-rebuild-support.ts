import { useMutation } from "./overview-imports.ts";

const useOverviewRebuildMutation = () =>
  useMutation({
    // oxlint-disable-next-line effecttsgo/async-function -- [EH-058] React query mutation is an intentional browser async boundary.
    mutationFn: async () => {
      // oxlint-disable-next-line effecttsgo/global-fetch -- [EH-099] Browser mutation boundary is owned by the UI query client.
      const response = await fetch("/development/rebuild", { method: "POST" });
      if (!response.ok) {
        throw new Error("The demonstration build could not be started");
      }
      return response.text();
    },
  });

export default useOverviewRebuildMutation;
