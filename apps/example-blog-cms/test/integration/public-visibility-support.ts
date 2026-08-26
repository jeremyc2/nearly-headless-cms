import type { ExampleSystem } from "../../src/core/composition.ts";

const authorIndex = 0,
  createdEntryStatus = 201,
  exportTimeoutMilliseconds = 30_000,
  exportUrl = "http://cms.test/api/v1/headless/export",
  formatPublishedAt = (postNumber: number): string => {
    const hour = String(postNumber % hoursPerDay).padStart(hourTextWidth, "0");
    return `2026-08-22T${hour}:00:00.000Z`;
  },
  hourTextWidth = 2,
  hoursPerDay = 24,
  isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    value !== null && typeof value === "object" && !Array.isArray(value),
  jsonRecord = (response: Response): Promise<Readonly<Record<string, unknown>>> =>
    response.json().then((body: unknown) => {
      if (!isRecord(body)) {
        throw new TypeError("Expected a JSON object");
      }
      return body;
    }),
  loopIncrement = 1,
  managementEntriesUrl = (contentTypeIdentifier: string): string =>
    `http://cms.test/api/v1/management/definition-spaces/example-blog-cms/content-types/${contentTypeIdentifier}/entries`,
  notFoundStatus = 404,
  postsToCreate = 101,
  // oxlint-disable-next-line effecttsgo/missing-pipeable-signature -- [EH-132] test JSON field helper is intentionally a direct two-argument operation.
  readRecordArray = (
    record: Readonly<Record<string, unknown>>,
    key: string,
  ): readonly Readonly<Record<string, unknown>>[] => {
    const value = record[key];
    if (!Array.isArray(value) || !value.every((item) => isRecord(item))) {
      throw new TypeError(`Expected record array field ${key}`);
    }
    return value;
  },
  // oxlint-disable-next-line effecttsgo/missing-pipeable-signature -- [EH-132] test JSON field helper is intentionally a direct two-argument operation.
  readStringField = (record: Readonly<Record<string, unknown>>, key: string): string => {
    const value = record[key];
    if (typeof value !== "string") {
      throw new TypeError(`Expected string field ${key}`);
    }
    return value;
  },
  requireDraftPostId = (system: ExampleSystem): string => {
    const draftPostId = system.seed?.draftPostId;
    if (draftPostId === undefined) {
      throw new Error("Expected a seeded draft Post identifier");
    }
    return draftPostId;
  },
  requireEntryIdentifier = (record: Readonly<Record<string, unknown>>): string => {
    const nestedEntry = record["entry"];
    if (isRecord(nestedEntry)) {
      return readStringField(nestedEntry, "id");
    }
    return readStringField(record, "id");
  },
  richTextVersion = 1;

export type PublicVisibilityHandler = ExampleSystem["handler"];

export {
  authorIndex,
  createdEntryStatus,
  exportTimeoutMilliseconds,
  exportUrl,
  formatPublishedAt,
  isRecord,
  jsonRecord,
  loopIncrement,
  managementEntriesUrl,
  notFoundStatus,
  postsToCreate,
  readRecordArray,
  readStringField,
  requireDraftPostId,
  requireEntryIdentifier,
  richTextVersion,
};
