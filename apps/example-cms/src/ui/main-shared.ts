import { QueryClient } from "@tanstack/react-query";
import { RichText } from "nearly-headless-cms";
import type { MouseEvent } from "react";
import { makeManagementClient } from "../generated/management-client.ts";

export const contentTypes = [
    { identifier: "post", label: "Posts", symbol: "P" },
    { identifier: "author", label: "Authors", symbol: "A" },
    { identifier: "category", label: "Categories", symbol: "C" },
    { identifier: "tag", label: "Tags", symbol: "T" },
    { identifier: "comment", label: "Comments", symbol: "M" },
  ] as const,
  managementClient = makeManagementClient(),
  preserveSelection = (event: MouseEvent<HTMLButtonElement>): void => {
    event.preventDefault();
  },
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 10_000 } },
  }),
  richTextDocumentFrom = (value: unknown): RichText.Document | undefined => {
    try {
      return RichText.validate(value);
    } catch {
      return undefined;
    }
  };
