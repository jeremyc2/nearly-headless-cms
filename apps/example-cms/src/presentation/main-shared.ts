import { type MouseEvent } from "react";
import { QueryClient } from "@tanstack/react-query";
import { RichText } from "nearly-headless-cms";
import { makeManagementClient } from "../generated/management-client.ts";

export const contentTypes = [
    { identifier: "post", label: "Posts", symbol: "P" },
    { identifier: "author", label: "Authors", symbol: "A" },
    { identifier: "category", label: "Categories", symbol: "C" },
    { identifier: "tag", label: "Tags", symbol: "T" },
    { identifier: "comment", label: "Comments", symbol: "M" },
  ] as const,
  managementClient = makeManagementClient(),
  preserveSelection = <Event extends MouseEvent<HTMLButtonElement>>(
    event: Readonly<Event>,
  ): void => {
    event.preventDefault();
  },
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 10_000 } },
  }),
  richTextDocumentFrom = (value: unknown): RichText.Document | undefined => {
    try {
      RichText.validate(value);
    } catch {
      return undefined;
    }
    if (
      typeof value !== "object" ||
      value === null ||
      !("children" in value) ||
      !("format" in value) ||
      !("version" in value) ||
      value.format !== RichText.format ||
      value.version !== RichText.formatVersion ||
      !Array.isArray(value.children)
    ) {
      return undefined;
    }
    return {
      children: value.children,
      format: value.format,
      version: value.version,
    };
  };
