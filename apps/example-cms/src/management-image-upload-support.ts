import { CmsError, type ContentDefinition } from "nearly-headless-cms";
import { Effect } from "effect";
import managementSupport from "./management-support.ts";

interface ReplaceRichTextAssetValueInput {
  readonly child: ContentDefinition.JsonValue;
  readonly key: string;
  readonly newAssetId: string;
  readonly oldAssetId: string;
}

interface UsesAssetInput {
  readonly assetId: string;
  readonly directField: string;
  readonly richTextField: string;
  readonly values: ContentDefinition.JsonObject;
}

const { conditionalProperty, isJsonValueArray, isRecord } = managementSupport,
  parseReplacementMetadata = (
    metadataValue: FormDataEntryValue | null,
    contentValue: FormDataEntryValue | null,
  ): Promise<{
    content: Uint8Array;
    filename: string;
    mediaType: string;
    defaultAlternativeText?: string;
    height?: number;
    width?: number;
  }> => {
    if (typeof metadataValue !== "string" || !(contentValue instanceof File)) {
      throw new Error("invalid replacement upload");
    }
    const metadata: unknown = JSON.parse(metadataValue);
    if (metadata === null || typeof metadata !== "object" || Array.isArray(metadata)) {
      throw new Error("invalid replacement metadata");
    }
    if (!isRecord(metadata)) {
      throw new Error("invalid replacement metadata");
    }
    return contentValue.arrayBuffer().then((content) => ({
      content: new Uint8Array(content),
      ...readReplacementMetadataFields(metadata),
    }));
  },
  parseReplacementUpload = <RequestType extends Request>(request: Readonly<RequestType>) =>
    Effect.tryPromise({
      catch: () =>
        CmsError.InvalidInput.make({
          message: "Image replacement requires multipart metadata and content",
        }),
      try: () =>
        request
          .formData()
          .then((form) => parseReplacementMetadata(form.get("metadata"), form.get("content"))),
    }),
  readReplacementMetadataFields = <Metadata extends Record<string, unknown>>(
    metadata: Readonly<Metadata>,
  ): {
    defaultAlternativeText?: string;
    filename: string;
    height?: number;
    mediaType: string;
    width?: number;
  } => {
    const { defaultAlternativeText, filename, height, mediaType, width } = metadata;
    if (typeof filename !== "string" || typeof mediaType !== "string") {
      throw new TypeError("invalid replacement metadata");
    }
    return {
      filename,
      mediaType,
      ...conditionalProperty(
        typeof defaultAlternativeText === "string",
        "defaultAlternativeText",
        defaultAlternativeText,
      ),
      ...conditionalProperty(typeof height === "number", "height", height),
      ...conditionalProperty(typeof width === "number", "width", width),
    };
  },
  replaceRichTextAsset = (
    value: ContentDefinition.JsonValue,
    oldAssetId: string,
    newAssetId: string,
  ): ContentDefinition.JsonValue => {
    if (isJsonValueArray(value)) {
      return value.map((item) => replaceRichTextAsset(item, oldAssetId, newAssetId));
    }
    if (value === null || typeof value !== "object") {
      return value;
    }
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        replaceRichTextAssetValue({ child, key, newAssetId, oldAssetId }),
      ]),
    );
  },
  replaceRichTextAssetValue = ({
    child,
    key,
    newAssetId,
    oldAssetId,
  }: Readonly<ReplaceRichTextAssetValueInput>): ContentDefinition.JsonValue => {
    if (key === "assetId" && child === oldAssetId) {
      return newAssetId;
    }
    return replaceRichTextAsset(child, oldAssetId, newAssetId);
  },
  usesAsset = ({
    assetId,
    directField,
    richTextField,
    values,
  }: Readonly<UsesAssetInput>): boolean => {
    if (values[directField] === assetId) {
      return true;
    }
    const richText = values[richTextField];
    return richText !== undefined && JSON.stringify(richText).includes(`"assetId":"${assetId}"`);
  };

export default {
  parseReplacementUpload,
  replaceRichTextAsset,
  usesAsset,
};
