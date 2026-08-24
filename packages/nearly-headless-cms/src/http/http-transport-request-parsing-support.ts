import { type IngestInput } from "../asset.ts";
import { InvalidInput } from "../cms-error.ts";
import { type JsonObject, isJsonObject } from "../internal/json.ts";

const alternativeTextProperty = (
    value: string | undefined,
  ): { readonly defaultAlternativeText?: string } => {
    if (value === undefined) {
      return {};
    }
    return { defaultAlternativeText: value };
  },
  assetMetadataAllowedKeys = new Set([
    "defaultAlternativeText",
    "filename",
    "height",
    "mediaType",
    "width",
  ]),
  buildAssetMetadataInput = (parsed: JsonObject): Omit<IngestInput, "content"> => {
    validateAssetMetadataKeys(parsed);
    const defaultAlternativeText = readOptionalStringField(
        parsed,
        "defaultAlternativeText",
        "Asset alternative text must be a string",
      ),
      filename = readRequiredStringField(parsed, "filename"),
      height = readOptionalPositiveIntegerField(
        parsed,
        "height",
        "Asset height must be a positive integer",
      ),
      mediaType = readRequiredStringField(parsed, "mediaType"),
      width = readOptionalPositiveIntegerField(
        parsed,
        "width",
        "Asset width must be a positive integer",
      );
    if (filename === undefined || mediaType === undefined) {
      throw InvalidInput.make({ message: "Asset metadata requires filename and mediaType" });
    }
    return {
      filename,
      mediaType,
      ...alternativeTextProperty(defaultAlternativeText),
      ...dimensionProperty("height", height),
      ...dimensionProperty("width", width),
    };
  },
  dimensionProperty = (
    key: "height" | "width",
    value: number | undefined,
  ): { readonly height?: number; readonly width?: number } => {
    if (value === undefined) {
      return {};
    }
    if (key === "width") {
      return { width: value };
    }
    return { height: value };
  },
  parseAssetMetadata = (text: string): Omit<IngestInput, "content"> =>
    buildAssetMetadataInput(parseAssetMetadataObject(text)),
  parseAssetMetadataObject = (text: string): JsonObject => {
    let parsed: unknown = undefined;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw InvalidInput.make({ message: "Asset metadata must be valid JSON" });
    }
    if (!isJsonObject(parsed)) {
      throw InvalidInput.make({ message: "Asset metadata must be a JSON object" });
    }
    return parsed;
  },
  readOptionalPositiveIntegerField = (
    parsed: JsonObject,
    key: "height" | "width",
    message: string,
  ): number | undefined => {
    const value = parsed[key];
    if (value === undefined) {
      return undefined;
    }
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
      throw InvalidInput.make({ message });
    }
    return value;
  },
  readOptionalStringField = (
    parsed: JsonObject,
    key: string,
    message: string,
  ): string | undefined => {
    const value = parsed[key];
    if (value === undefined) {
      return undefined;
    }
    if (typeof value !== "string") {
      throw InvalidInput.make({ message });
    }
    return value;
  },
  readRequiredStringField = (parsed: JsonObject, key: string): string | undefined => {
    const value = parsed[key];
    if (typeof value !== "string") {
      return undefined;
    }
    return value;
  },
  validateAssetMetadataKeys = (parsed: JsonObject): void => {
    const unexpectedKey = Object.keys(parsed).find((key) => !assetMetadataAllowedKeys.has(key));
    if (unexpectedKey !== undefined) {
      throw InvalidInput.make({
        message: `Asset metadata contains unexpected key ${unexpectedKey}`,
      });
    }
  };

export default {
  parseAssetMetadata,
};
