import type { ExampleSystem } from "../../src/core/composition.ts";

const createTemporaryStorageRoot = (testDirectory: string): Promise<string> =>
    Bun.$`mktemp -d ${testDirectory}/.headless-api-XXXXXX`.text().then((output) => output.trim()),
  exportUrl = "http://cms.test/api/v1/headless/export",
  firstItemIndex = 0,
  httpBadRequest = 400,
  httpConflict = 409,
  httpCreated = 201,
  httpNotFound = 404,
  httpNotModified = 304,
  httpOk = 200,
  httpPartialContent = 206,
  isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    value !== null && typeof value === "object" && !Array.isArray(value),
  jsonRecord = (response: Response): Promise<Readonly<Record<string, unknown>>> =>
    response.json().then((body: unknown) => {
      if (!isRecord(body)) {
        throw new TypeError("Expected a JSON object");
      }
      return body;
    }),
  // oxlint-disable-next-line effecttsgo/missing-pipeable-signature -- [EH-133] test URL helper is intentionally a direct two-argument operation.
  managementStateUrl = (contentTypeId: string, entryId: string): string =>
    `http://cms.test/api/v1/management/definition-spaces/example-blog-cms/content-types/${contentTypeId}/entries/${entryId}/state`,
  oneItem = 1,
  removeStorageRoot = (storageRoot: string): Promise<void> =>
    Bun.$`rm -rf ${storageRoot}`.then(() => {}),
  requirePublishedPostId = (system: ExampleSystem): string => {
    const publishedPostId = system.seed?.publishedPostId;
    if (publishedPostId === undefined) {
      throw new Error("Expected a seeded published Post identifier");
    }
    return publishedPostId;
  },
  // oxlint-disable-next-line effecttsgo/missing-pipeable-signature -- [EH-125] JSON field helper is intentionally a direct two-argument operation.
  requireStringField = (record: Readonly<Record<string, unknown>>, key: string): string => {
    const value = record[key];
    if (typeof value !== "string") {
      throw new TypeError(`Expected string field ${key}`);
    }
    return value;
  },
  requireWriteToken = (state: Readonly<Record<string, unknown>>): string =>
    requireStringField(state, "writeToken"),
  tenBytes = 10,
  twoItems = 2;

export type HeadlessApiHandler = ExampleSystem["handler"];

export {
  createTemporaryStorageRoot,
  exportUrl,
  firstItemIndex,
  httpBadRequest,
  httpConflict,
  httpCreated,
  httpNotFound,
  httpNotModified,
  httpOk,
  httpPartialContent,
  isRecord,
  jsonRecord,
  managementStateUrl,
  oneItem,
  removeStorageRoot,
  requirePublishedPostId,
  requireWriteToken,
  tenBytes,
  twoItems,
};
