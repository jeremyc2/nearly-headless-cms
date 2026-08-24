import type { Dispatch, SetStateAction } from "react";
import { stringValue, suggestedSlug } from "./main-entry-support.ts";

export const createFieldUpdater =
  (setValues: Dispatch<SetStateAction<Record<string, unknown>>>) =>
  (key: string, value: unknown): void => {
    setValues((current) => {
      const replacement = { ...current, [key]: value };
      if (
        (key === "title" || key === "name") &&
        typeof value === "string" &&
        typeof current["slug"] === "string" &&
        (current["slug"] === suggestedSlug(stringValue(current[key], "")) ||
          current["slug"].startsWith("untitled-"))
      ) {
        return { ...replacement, slug: suggestedSlug(value) };
      }
      return replacement;
    });
  },
  normalizeSaveResult = (
    result:
      | { readonly entry: { readonly values: Record<string, unknown> } }
      | { readonly values: Record<string, unknown> },
  ): { readonly entry: { readonly values: Record<string, unknown> } } => {
    if ("entry" in result) {
      return result;
    }
    return { entry: result };
  },
  titleFieldFrom = (values: Record<string, unknown>): string => {
    if ("title" in values) {
      return "title";
    }
    if ("name" in values) {
      return "name";
    }
    return "display-name";
  };
