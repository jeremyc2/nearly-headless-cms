import { type EntryRepresentation, ManagementClientFailure } from "../generated/management-client.ts";
import { Schema } from "effect";

export interface EditorialIssue {
  readonly path: readonly (string | number)[];
  readonly reason: string;
}

export const deletionConsequence = (contentTypeId: string): string => {
    switch (contentTypeId) {
      case "post": {
        return "This also deletes every Comment associated with the Post.";
      }
      case "author": {
        return "This also deletes the Author’s Posts and every Comment associated with them.";
      }
      case "category": {
        return "This detaches the Category from every Post before deleting it.";
      }
      case "tag": {
        return "This detaches the Tag from every Post before deleting it.";
      }
      default: {
        return "This removes the Entry from live content.";
      }
    }
  },
  deletionRecordFrom = (
    value: unknown,
  ):
    | {
        readonly contentTypeId: string;
        readonly entryId: string;
        readonly writeToken: string;
      }
    | undefined => {
    let candidate = value;
    if (isRecord(value) && isRecord(value["deletionRecord"])) {
      candidate = value["deletionRecord"];
    }
    if (
      isRecord(candidate) &&
      typeof candidate["contentTypeId"] === "string" &&
      typeof candidate["entryId"] === "string" &&
      typeof candidate["writeToken"] === "string"
    ) {
      return {
        contentTypeId: candidate["contentTypeId"],
        entryId: candidate["entryId"],
        writeToken: candidate["writeToken"],
      };
    }
    return undefined;
  },
  displayName = (entry: EntryRepresentation): string =>
    stringValue(
      entry.values["title"] ?? entry.values["name"] ?? entry.values["display-name"],
      entry.id,
    ),
  editorialIssues = (error: unknown): readonly EditorialIssue[] => {
    if (
      !Schema.is(ManagementClientFailure)(error) ||
      error.details === null ||
      typeof error.details !== "object"
    ) {
      return [];
    }
    const candidates: unknown = Reflect.get(error.details, "issues");
    if (!Array.isArray(candidates)) {
      return [];
    }
    return candidates.flatMap((candidate) => {
      if (candidate === null || typeof candidate !== "object") {
        return [];
      }
      const path: unknown = Reflect.get(candidate, "path"),
        reason: unknown = Reflect.get(candidate, "reason");
      if (Array.isArray(path) && typeof reason === "string") {
        return [{ path, reason }];
      }
      return [];
    });
  },
  isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    value !== null && typeof value === "object" && !Array.isArray(value),
  // oxlint-disable-next-line effecttsgo/missing-pipeable-signature -- UI value helper is intentionally a direct two-argument operation.
  stringValue = (value: unknown, fallback: string): string => {
    if (typeof value === "string") {
      return value;
    }
    return fallback;
  },
  suggestedSlug = (value: string): string =>
    value
      .normalize("NFKD")
      .toLocaleLowerCase()
      .replaceAll(/[^a-z0-9]+/gu, "-")
      .replaceAll(/^-|-$/gu, "");
