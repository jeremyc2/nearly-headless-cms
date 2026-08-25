import {
  acceptedStatus,
  badRequestStatus,
  contentTooLargeStatus,
  payloadByteFive,
  payloadByteFour,
  payloadByteOne,
  payloadByteSix,
  payloadByteThree,
  payloadByteTwo,
  readJsonCode,
  snapshot,
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
      // oxlint-disable-next-line effecttsgo/strict-effect-provide -- test entry point needs a fresh isolated layer.
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
  // oxlint-disable-next-line effecttsgo/async-function -- HTTP contract assertions intentionally await native promises.
  runMultipartContract = async (): Promise<void> => {
    const handler = await makeMultipartHandler();
    await verifyOversizedMultipart(handler);
    await verifyUnexpectedMetadata(handler);
    await verifyAcceptedMultipart(handler);
  },
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- HTTP contract assertions intentionally await native promises.
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
  verifyMultipartAssetUpload = (): Promise<void> => runMultipartContract(),
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- HTTP contract assertions intentionally await native promises.
  verifyOversizedMultipart = async (handler: MultipartHandler): Promise<void> => {
    const formOversized = makeOversizedForm(),
      responseOversized = await handler(
        new Request(assetUrl, { body: formOversized, method: "POST" }),
      );
    expect(responseOversized.status).toBe(contentTooLargeStatus);
    expect(await readJsonCode(responseOversized)).toBe("PayloadTooLarge");
  },
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- HTTP contract assertions intentionally await native promises.
  verifyUnexpectedMetadata = async (handler: MultipartHandler): Promise<void> => {
    const formUnexpectedMetadata = makeUnexpectedMetadataForm(),
      responseUnexpectedMetadata = await handler(
        new Request(assetUrl, { body: formUnexpectedMetadata, method: "POST" }),
      );
    expect(responseUnexpectedMetadata.status).toBe(badRequestStatus);
  };

export { verifyMultipartAssetUpload };
