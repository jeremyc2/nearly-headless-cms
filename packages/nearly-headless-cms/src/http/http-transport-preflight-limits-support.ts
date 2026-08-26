import {
  httpStatusHeadersTooLarge,
  httpStatusNotAcceptable,
  httpStatusPayloadTooLarge,
  httpStatusUriTooLong,
} from "./http-status-codes.ts";
import type { ReadonlyTransportRequest } from "./http-transport-readonly-types.ts";
import { RequestFailureError } from "./http-transport-request-failure.ts";

const acceptsJson = (accept: string | null): boolean => {
    if (accept === null) {
      return true;
    }
    return accept.split(",").some((mediaRange) => {
      const mediaType = mediaRange.split(";", 1)[0]?.trim().toLowerCase();
      return mediaType === "*/*" || mediaType === "application/json";
    });
  },
  computeHeaderByteLength = (request: ReadonlyTransportRequest): number =>
    [...request.headers].reduce(
      (total, [name, value]) => total + name.length + value.length + headerFieldSeparatorByteLength,
      0,
    ),
  headerFieldSeparatorByteLength = 4,
  isAssetRequest = (request: ReadonlyTransportRequest): boolean => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return false;
    }
    return /\/assets\/[^/]+$/u.test(new URL(request.url).pathname);
  },
  validateHeaderByteLength = (
    request: ReadonlyTransportRequest,
    maximumHeaderByteLength: number,
  ): RequestFailureError | undefined => {
    if (computeHeaderByteLength(request) > maximumHeaderByteLength) {
      return new RequestFailureError(
        "HeadersTooLarge",
        "Request headers exceed the configured limit",
        httpStatusHeadersTooLarge,
      );
    }
    return undefined;
  },
  validateJsonAccept = (
    request: ReadonlyTransportRequest,
    accept: string | null,
  ): RequestFailureError | undefined => {
    if (!isAssetRequest(request) && !acceptsJson(accept)) {
      return new RequestFailureError(
        "NotAcceptable",
        "The requested response media type is not available",
        httpStatusNotAcceptable,
      );
    }
    return undefined;
  },
  validateJsonBodyByteLength = (
    declaredBodyByteLength: number,
    maximumJsonBodyByteLength: number,
  ): RequestFailureError | undefined => {
    if (
      Number.isFinite(declaredBodyByteLength) &&
      declaredBodyByteLength > maximumJsonBodyByteLength
    ) {
      return new RequestFailureError(
        "PayloadTooLarge",
        "Request body exceeds the configured limit",
        httpStatusPayloadTooLarge,
      );
    }
    return undefined;
  },
  validateUrlLength = (
    request: ReadonlyTransportRequest,
    maximumUrlLength: number,
  ): RequestFailureError | undefined => {
    if (request.url.length > maximumUrlLength) {
      return new RequestFailureError(
        "UriTooLong",
        "Request URL exceeds the configured limit",
        httpStatusUriTooLong,
      );
    }
    return undefined;
  };

export default {
  validateHeaderByteLength,
  validateJsonAccept,
  validateJsonBodyByteLength,
  validateUrlLength,
};
