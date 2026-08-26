export type { ExampleSystem } from "../../src/core/composition.ts";
export {
  createTemporaryStorageRoot,
  exportUrl,
  firstItemIndex,
  httpBadRequest,
  isRecord,
  jsonRecord,
  managementStateUrl,
  removeStorageRoot,
  requireWriteToken,
} from "./headless-api-support.ts";
export {
  managementEntriesUrl,
  readRecordArray,
  readStringField,
  requireDraftPostId,
  requireEntryIdentifier,
  richTextVersion,
} from "./public-visibility-support.ts";
import { firstItemIndex, isRecord } from "./headless-api-support.ts";
import { readRecordArray, readStringField } from "./public-visibility-support.ts";
import type { ExampleSystem } from "../../src/core/composition.ts";

export type PublicationValidationHandler = ExampleSystem["handler"];

// oxlint-disable-next-line effecttsgo/missing-pipeable-signature -- [EH-133] test URL helper is intentionally a direct two-argument operation.
const managementEntryUrl = (contentTypeIdentifier: string, entryIdentifier: string): string =>
    `http://cms.test/api/v1/management/definition-spaces/example-blog/content-types/${contentTypeIdentifier}/entries/${entryIdentifier}`,
  // oxlint-disable-next-line effecttsgo/missing-pipeable-signature -- [EH-133] test URL helper is intentionally a direct two-argument operation.
  publishPostUrl = (postIdentifier: string): string =>
    `http://cms.test/api/v1/management/definition-spaces/example-blog/operations/posts/${postIdentifier}/publications`,
  readEntryValues = (
    state: Readonly<Record<string, unknown>>,
  ): Readonly<Record<string, unknown>> => {
    const { entry } = state;
    if (!isRecord(entry)) {
      throw new TypeError("Expected entry field");
    }
    if (!isRecord(entry["values"])) {
      throw new TypeError("Expected entry values");
    }
    return entry["values"];
  },
  readFirstAssetId = (exported: Readonly<Record<string, unknown>>): string | undefined => {
    const assets = readRecordArray(exported, "assets"),
      firstAsset = assets[firstItemIndex];
    if (firstAsset === undefined) {
      return undefined;
    }
    return readStringField(firstAsset, "id");
  },
  readValidationIssues = (
    failure: Readonly<Record<string, unknown>>,
  ): readonly Readonly<Record<string, unknown>>[] => {
    const { details } = failure;
    if (!isRecord(details)) {
      throw new TypeError("Expected details field");
    }
    return readRecordArray(details, "issues");
  };

export {
  managementEntryUrl,
  publishPostUrl,
  readEntryValues,
  readFirstAssetId,
  readValidationIssues,
};
