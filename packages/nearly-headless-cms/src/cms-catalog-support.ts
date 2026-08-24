import {
  type CompiledContentType,
  type CompiledSnapshot,
  type SnapshotInput,
} from "./content-definition.ts";
import { Conflict, InvalidInput } from "./cms-error.ts";
import type { Revision } from "./entry-history.ts";
import { canonicalJson } from "./internal/json.ts";
import type { CatalogState } from "./persistence.ts";
import { Effect, Schema } from "effect";

interface HistoryCursorPayload {
  readonly entryId: string;
  readonly offset: number;
}

const applyRetention = (
    revisions: readonly Revision[],
    contentType: CompiledContentType,
    now: number,
  ): readonly Revision[] => {
    const policy = contentType.definition.revisionRetention;
    if (policy === undefined) {
      return revisions;
    }
    let retained = [...revisions];
    if (policy.maximumAgeMilliseconds !== undefined) {
      retained = retained.filter(
        (revision, index) =>
          index === retained.length - 1 ||
          (policy.maximumAgeMilliseconds !== undefined &&
            now - Date.parse(revision.recordedAt) <= policy.maximumAgeMilliseconds),
      );
    }
    if (
      policy.maximumRevisionCount !== undefined &&
      retained.length > policy.maximumRevisionCount
    ) {
      retained = retained.slice(-Math.max(1, policy.maximumRevisionCount));
    }
    return retained;
  },
  attempt = <Value>(operation: () => Value): Effect.Effect<Value, InvalidInput> =>
    Effect.try({
      catch: (cause) => {
        if (Schema.is(InvalidInput)(cause)) {
          return cause;
        }
        let message = "Invalid input";
        if (cause instanceof Error) {
          ({ message } = cause);
        }
        return InvalidInput.make({ message });
      },
      try: operation,
    }),
  compatibleManifest = (source: CompiledSnapshot, target: CompiledSnapshot) => ({
    compatible: true,
    handlerIdentifier: "nearly-headless-cms.compatible-identity",
    handlerVersion: 1,
    id: `compatible-${source.snapshotId}-${target.snapshotId}`,
    sourceSnapshotId: source.snapshotId,
    targetSnapshotId: target.snapshotId,
  }),
  decodeHistoryCursor = (cursor: string | undefined, entryId: string): number => {
    if (cursor === undefined) {
      return 0;
    }
    try {
      const normalized = cursor.replaceAll("-", "+").replaceAll("_", "/"),
        paddingLength = Math.ceil(normalized.length / 4) * 4,
        parsed: unknown = JSON.parse(atob(normalized.padEnd(paddingLength, "="))),
        payload = historyCursorPayloadFromUnknown(parsed),
        { entryId: parsedEntryId, offset } = payload ?? { entryId: "", offset: 0 };
      if (payload === undefined || parsedEntryId !== entryId) {
        throw new Error("invalid");
      }
      return offset;
    } catch {
      throw Conflict.make({ message: "History cursor is invalid or belongs to another Entry" });
    }
  },
  historyCursor = (offset: number, entryId: string): string =>
    btoa(JSON.stringify({ entryId, offset }))
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replace(/=+$/u, ""),
  historyCursorPayloadFromUnknown = (value: unknown): HistoryCursorPayload | undefined => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return undefined;
    }
    const record: Record<string, unknown> = { ...value },
      {offset} = record,
      parsedEntryId = record["entryId"];
    if (
      typeof parsedEntryId !== "string" ||
      typeof offset !== "number" ||
      !Number.isSafeInteger(offset)
    ) {
      return undefined;
    }
    return { entryId: parsedEntryId, offset };
  },
  parentRevisionProperty = (
    parentRevision: number | undefined,
  ): { readonly parentRevision?: number } => {
    if (parentRevision === undefined) {
      return {};
    }
    return { parentRevision };
  },
  snapshotDefinitionValidationMessage = (
    state: CatalogState,
    snapshot: SnapshotInput,
  ): string | undefined => {
    for (const definition of snapshot.definitions) {
      const catalogRevision = state.revisions.find(
          (record) =>
            record.definitionId === definition.id && record.revision === (definition.revision ?? 1),
        ),
        revision = definition.revision ?? 1;
      if (
        catalogRevision === undefined ||
        canonicalJson(catalogRevision.definition) !== canonicalJson(definition)
      ) {
        return `Definition ${definition.id} revision ${revision} has not been appended to the Catalog`;
      }
      if (state.retiredDefinitionIds.has(definition.id)) {
        const activeDefinitionRevision =
          state.active.input.definitions.find((candidate) => candidate.id === definition.id)
            ?.revision ?? 0;
        if (revision <= activeDefinitionRevision) {
          return `Retired Definition ${definition.id} requires a new revision before reactivation`;
        }
      }
    }
    return undefined;
  },
  sourceProperty = (source: string | undefined): { readonly source?: string } => {
    if (source === undefined) {
      return {};
    }
    return { source };
  },
  writeTokenProperty = (writeToken: string | undefined): { readonly writeToken?: string } => {
    if (writeToken === undefined) {
      return {};
    }
    return { writeToken };
  };

export default {
  applyRetention,
  attempt,
  compatibleManifest,
  decodeHistoryCursor,
  historyCursor,
  parentRevisionProperty,
  snapshotDefinitionValidationMessage,
  sourceProperty,
  writeTokenProperty,
};
