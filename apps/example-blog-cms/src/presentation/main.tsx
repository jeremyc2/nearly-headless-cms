import "./styles.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import {
  bootstrapDevelopmentAuthToken,
  installAuthenticatedManagementFetch,
} from "./auth-session.ts";
import mainRoutesSupport from "./main-routes-support.ts";
import { queryClient } from "./main-shared.ts";

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof mainRoutesSupport;
  }
}

installAuthenticatedManagementFetch();
await bootstrapDevelopmentAuthToken("");

const container = document.querySelector("#root");
if (container === null) {
  throw new Error("Example Blog CMS root element is missing");
}
createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={mainRoutesSupport} />
    </QueryClientProvider>
  </StrictMode>,
);
