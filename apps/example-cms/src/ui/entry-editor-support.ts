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
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-203] save results may return entry values directly or nested under entry.
    result:
      | { readonly entry: { readonly values: Record<string, unknown> } }
      | { readonly values: Record<string, unknown> },
  ): { readonly entry: { readonly values: Record<string, unknown> } } => {
    if ("entry" in result) {
      return result;
    }
    return { entry: result };
  },
  titleFieldFrom = <Values extends Record<string, unknown>>(values: Readonly<Values>): string => {
    if ("title" in values) {
      return "title";
    }
    if ("name" in values) {
      return "name";
    }
    return "display-name";
  };
