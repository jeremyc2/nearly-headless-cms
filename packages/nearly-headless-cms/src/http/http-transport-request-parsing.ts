import { type JsonObject, isJsonObject } from "../internal/json.ts";
import type {
  ReadonlyTransportAbortSignal,
  ReadonlyTransportRequest,
} from "./http-transport-readonly-types.ts";
import { httpStatusPayloadTooLarge, httpStatusUnsupportedMediaType } from "./http-status-codes.ts";
import type { IngestInput } from "../asset.ts";
import { InvalidInput } from "../cms-error.ts";
import { RequestFailureError } from "./http-transport-request-failure.ts";
import requestParsingSupport from "./http-transport-request-parsing-support.ts";

type MultipartAssetLimits = Parameters<
  typeof requestParsingSupport.stageMultipartAsset
>[0]["limits"];

const alternativeTextProperty = (
    value: string | undefined,
  ): { readonly defaultAlternativeText?: string } => {
    if (value === undefined) {
      return {};
    }
    return { defaultAlternativeText: value };
  },
  assertJsonMediaType = (request: Pick<Request, "headers">): void => {
    if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
      throw new RequestFailureError(
        "UnsupportedMediaType",
        "Expected application/json request media",
        httpStatusUnsupportedMediaType,
      );
    }
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
  // oxlint-disable-next-line effecttsgo/async-function, effecttsgo/missing-pipeable-signature -- [EH-066, EH-100] Web Request.arrayBuffer is Promise-based and this helper is not a pipeable Effect API.
  parseJson = async (
    request: Pick<Request, "arrayBuffer" | "headers" | "json" | "method">,
    maximumByteLength: number,
  ): Promise<JsonObject> => {
    assertJsonMediaType(request);
    const bytes = await readBoundedJsonBytes(request, maximumByteLength);
    return parseJsonObjectFromBytes(bytes);
  },
  parseJsonObjectFromBytes = <Bytes extends Uint8Array>(bytes: Readonly<Bytes>): JsonObject => {
    let value: unknown = undefined;
    try {
      value = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      throw InvalidInput.make({ message: "Malformed JSON request body" });
    }
    if (!isJsonObject(value)) {
      throw InvalidInput.make({ message: "JSON request body must be an object" });
    }
    return value;
  },
  readBoundedJsonBytes = (
    request: Pick<Request, "arrayBuffer">,
    maximumByteLength: number,
  ): Promise<Uint8Array> =>
    request.arrayBuffer().then((buffer) => {
      const bytes = new Uint8Array(buffer);
      if (bytes.byteLength > maximumByteLength) {
        throw new RequestFailureError(
          "PayloadTooLarge",
          "JSON request body exceeds the configured limit",
          httpStatusPayloadTooLarge,
        );
      }
      return bytes;
    }),
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
  // oxlint-disable-next-line effecttsgo/missing-pipeable-signature -- [EH-090] multipart parsing is Promise-based and this helper is not a pipeable Effect API.
  stageMultipartAsset = (
    request: ReadonlyTransportRequest,
    signal: ReadonlyTransportAbortSignal,
    limits: MultipartAssetLimits,
  ): ReturnType<typeof requestParsingSupport.stageMultipartAsset> =>
    requestParsingSupport.stageMultipartAsset({
      limits,
      parseAssetMetadata,
      request,
      signal,
    }),
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
  parseJson,
  stageMultipartAsset,
};

export { parseJson, stageMultipartAsset };

export type {
  MultipartAssetLimits,
  StagedAssetUpload,
} from "./http-transport-request-parsing-support.ts";
