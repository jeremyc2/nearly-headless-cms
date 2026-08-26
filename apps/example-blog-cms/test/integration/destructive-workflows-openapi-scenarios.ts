import { type ExampleSystem, isRecord, jsonRecord } from "./destructive-workflows-support.ts";
import { expect } from "bun:test";

const readNestedRecord = (
    record: Readonly<Record<string, unknown>>,
    key: string,
  ): Readonly<Record<string, unknown>> | undefined => {
    const value = record[key];
    if (isRecord(value)) {
      return value;
    }
    return undefined;
  },
  readOpenApiDocument = (system: ExampleSystem): Promise<Readonly<Record<string, unknown>>> =>
    Promise.resolve(
      system.handler(new Request("http://cms.test/api/v1/management/openapi.json")),
    ).then(jsonRecord),
  readOptionalNestedRecord = (
    record: Readonly<Record<string, unknown>> | undefined,
    key: string,
  ): Readonly<Record<string, unknown>> | undefined => {
    if (record === undefined) {
      return undefined;
    }
    return readNestedRecord(record, key);
  },
  readReplacementPath = (
    document: Readonly<Record<string, unknown>>,
  ): Readonly<Record<string, unknown>> | undefined => {
    const { paths } = document;
    if (!isRecord(paths)) {
      return undefined;
    }
    return readNestedRecord(
      paths,
      "/api/v1/management/definition-spaces/{definitionSpaceId}/operations/assets/{assetId}/replacements",
    );
  },
  readReplacementRequestContent = (
    document: Readonly<Record<string, unknown>>,
  ): Readonly<Record<string, unknown>> | undefined => {
    const replacementPath = readReplacementPath(document),
      replacementPost = readOptionalNestedRecord(replacementPath, "post"),
      requestBody = readOptionalNestedRecord(replacementPost, "requestBody");
    if (requestBody === undefined) {
      return undefined;
    }
    return readNestedRecord(requestBody, "content");
  },
  verifyImageReplacementMultipart = (system: ExampleSystem): Promise<void> =>
    readOpenApiDocument(system).then((document) => {
      const content = readReplacementRequestContent(document);
      if (content === undefined) {
        throw new Error("Expected multipart content for Asset replacement");
      }
      expect(content["multipart/form-data"] !== undefined).toBeTrue();
    });

export { verifyImageReplacementMultipart };
