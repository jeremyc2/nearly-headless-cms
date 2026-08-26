import {
  acceptedStatus,
  badRequestStatus,
  contentTooLargeStatus,
  isRecord,
  notModifiedStatus,
  partialContentStatus,
  payloadByteFive,
  payloadByteFour,
  payloadByteOne,
  payloadByteSix,
  payloadByteThree,
  payloadByteTwo,
  readJsonCode,
  snapshot,
  successStatus,
} from "./http-contract-support.ts";
import { DevelopmentCms } from "../../src/testing/index.ts";
import { Effect } from "effect";
import { HttpTransport } from "../../src/http/index.ts";
import { expect } from "bun:test";

type MultipartHandler = <RequestType extends Request>(
  request: Readonly<RequestType>,
) => Response | Promise<Response>;

const assetUrl = "http://cms.test/api/v1/management/definition-spaces/example-blog/assets",
  makeAcceptedForm = (): FormData => {
    const form = new FormData();
    form.set("metadata", metadataJson);
    form.set(
      "content",
      makePixelFile([
        payloadByteOne,
        payloadByteTwo,
        payloadByteThree,
        payloadByteFour,
        payloadByteFive,
      ]),
    );
    return form;
  },
  makeMultipartHandler = (): Promise<MultipartHandler> => {
    const handlerEffect = HttpTransport.makeHandler({
      maximumMultipartFileByteLength: payloadByteFive,
      maximumMultipartMetadataByteLength: 256,
    }).pipe(
      // oxlint-disable-next-line effecttsgo/strict-effect-provide -- [EH-162] test entry point needs a fresh isolated layer.
      Effect.provide(DevelopmentCms.layer({ snapshot })),
    );
    return Effect.runPromise(handlerEffect);
  },
  makeOversizedForm = (): FormData => {
    const form = new FormData();
    form.set("metadata", metadataJson);
    form.set(
      "content",
      makePixelFile([
        payloadByteOne,
        payloadByteTwo,
        payloadByteThree,
        payloadByteFour,
        payloadByteFive,
        payloadByteSix,
      ]),
    );
    return form;
  },
  makePixelFile = (bytes: readonly number[]): File =>
    new File([new Uint8Array(bytes)], "pixel.bin", { type: "application/octet-stream" }),
  makeUnexpectedMetadataForm = (): FormData => {
    const form = new FormData();
    form.set("metadata", JSON.stringify({ digest: "client-owned", ...JSON.parse(metadataJson) }));
    form.set("content", makePixelFile([payloadByteOne, payloadByteTwo, payloadByteThree]));
    return form;
  },
  metadataJson = JSON.stringify({ filename: "pixel.bin", mediaType: "application/octet-stream" }),
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-038] HTTP contract assertions intentionally await native promises.
  readUploadedAssetIdentifier = async (handler: MultipartHandler): Promise<string> => {
    const assetUploadResponse = await handler(
        new Request(assetUrl, { body: makeAcceptedForm(), method: "POST" }),
      ),
      uploadBody: unknown = await assetUploadResponse.json();
    if (!isRecord(uploadBody) || typeof uploadBody["id"] !== "string") {
      throw new TypeError("Expected uploaded Asset identifier");
    }
    return uploadBody["id"];
  },
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-038] HTTP contract assertions intentionally await native promises.
  runMultipartContract = async (): Promise<void> => {
    const handler = await makeMultipartHandler();
    await verifyOversizedMultipart(handler);
    await verifyUnexpectedMetadata(handler);
    await verifyAcceptedMultipart(handler);
  },
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-038] HTTP contract assertions intentionally await native promises.
  runStreamedAssetContract = async (): Promise<void> => {
    const assetHandler = await makeMultipartHandler(),
      assetIdentifier = await readUploadedAssetIdentifier(assetHandler),
      contentUrl = `${assetUrl}/${assetIdentifier}/content`,
      etag = await verifyFullAssetResponse(assetHandler, contentUrl);
    await verifyConditionalAssetResponse(assetHandler, contentUrl, etag);
    await verifyHeadAndRangeAssetResponses(assetHandler, contentUrl);
  },
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-038] HTTP contract assertions intentionally await native promises.
  verifyAcceptedMultipart = async (handler: MultipartHandler): Promise<void> => {
    const formAccepted = makeAcceptedForm(),
      responseAccepted = await handler(
        new Request(assetUrl, { body: formAccepted, method: "POST" }),
      );
    expect(responseAccepted.status).toBe(acceptedStatus);
    expect(await responseAccepted.json()).toMatchObject({
      metadata: {
        byteLength: payloadByteFive,
        filename: "pixel.bin",
        mediaType: "application/octet-stream",
      },
    });
  },
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-038] HTTP contract assertions intentionally await native promises.
  verifyConditionalAssetResponse = async (
    handler: MultipartHandler,
    contentUrl: string,
    etag: string,
  ): Promise<void> => {
    const response = await handler(
      new Request(contentUrl, { headers: { "if-none-match": `"unrelated", W/${etag}` } }),
    );
    expect(response.status).toBe(notModifiedStatus);
  },
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-038] HTTP contract assertions intentionally await native promises.
  verifyFullAssetResponse = async (
    handler: MultipartHandler,
    contentUrl: string,
  ): Promise<string> => {
    const assetResponse = await handler(new Request(contentUrl)),
      etag = assetResponse.headers.get("etag");
    expect(assetResponse.status).toBe(successStatus);
    expect(new Uint8Array(await assetResponse.arrayBuffer())).toEqual(
      new Uint8Array([
        payloadByteOne,
        payloadByteTwo,
        payloadByteThree,
        payloadByteFour,
        payloadByteFive,
      ]),
    );
    if (etag === null) {
      throw new TypeError("Expected Asset ETag");
    }
    return etag;
  },
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-038] HTTP contract assertions intentionally await native promises.
  verifyHeadAndRangeAssetResponses = async (
    handler: MultipartHandler,
    contentUrl: string,
  ): Promise<void> => {
    const assetHeadResponse = await handler(new Request(contentUrl, { method: "HEAD" })),
      headBody = await assetHeadResponse.arrayBuffer(),
      rangeResponse = await handler(new Request(contentUrl, { headers: { range: "bytes=1-3" } }));
    expect(assetHeadResponse.status).toBe(successStatus);
    expect(assetHeadResponse.headers.get("content-length")).toBe(String(payloadByteFive));
    expect(headBody.byteLength).toBe(0);
    expect(rangeResponse.status).toBe(partialContentStatus);
    expect(rangeResponse.headers.get("content-range")).toBe("bytes 1-3/5");
    expect(new Uint8Array(await rangeResponse.arrayBuffer())).toEqual(
      new Uint8Array([payloadByteTwo, payloadByteThree, payloadByteFour]),
    );
  },
  verifyMultipartAssetUpload = (): Promise<void> => runMultipartContract(),
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-038] HTTP contract assertions intentionally await native promises.
  verifyOversizedMultipart = async (handler: MultipartHandler): Promise<void> => {
    const formOversized = makeOversizedForm(),
      responseOversized = await handler(
        new Request(assetUrl, { body: formOversized, method: "POST" }),
      );
    expect(responseOversized.status).toBe(contentTooLargeStatus);
    expect(await readJsonCode(responseOversized)).toBe("PayloadTooLarge");
  },
  verifyStreamedAssetDelivery = (): Promise<void> => runStreamedAssetContract(),
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-038] HTTP contract assertions intentionally await native promises.
  verifyUnexpectedMetadata = async (handler: MultipartHandler): Promise<void> => {
    const formUnexpectedMetadata = makeUnexpectedMetadataForm(),
      responseUnexpectedMetadata = await handler(
        new Request(assetUrl, { body: formUnexpectedMetadata, method: "POST" }),
      );
    expect(responseUnexpectedMetadata.status).toBe(badRequestStatus);
  };

export { verifyMultipartAssetUpload, verifyStreamedAssetDelivery };
