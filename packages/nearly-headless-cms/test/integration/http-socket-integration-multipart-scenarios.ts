import {
  DevelopmentCms,
  Effect,
  HttpTransport,
  acceptedStatus,
  expect,
  payloadByteFive,
  payloadByteFour,
  payloadByteOne,
  payloadByteThree,
  payloadByteTwo,
  snapshot,
  startBunHttpTransport,
} from "./http-socket-integration-multipart-scenarios-imports.ts";

const assetUploadPath = "api/v1/management/definition-spaces/example-blog/assets",
  makeAcceptedUploadForm = (): FormData => {
    const form = new FormData();
    form.set(
      "metadata",
      JSON.stringify({ filename: "pixel.bin", mediaType: "application/octet-stream" }),
    );
    form.set(
      "content",
      new File(
        [
          new Uint8Array([
            payloadByteOne,
            payloadByteTwo,
            payloadByteThree,
            payloadByteFour,
            payloadByteFive,
          ]),
        ],
        "pixel.bin",
        { type: "application/octet-stream" },
      ),
    );
    return form;
  },
  multipartHandlerEffect = HttpTransport.makeHandler({
    maximumMultipartFileByteLength: payloadByteFive,
    maximumMultipartMetadataByteLength: 256,
  }).pipe(
    // oxlint-disable-next-line effecttsgo/strict-effect-provide -- [EH-112] test entry point needs a fresh isolated layer.
    Effect.provide(DevelopmentCms.layer({ snapshot })),
  ),
  verifyMultipartUploadOverLiveSocket = (): Promise<void> =>
    Effect.runPromise(
      multipartHandlerEffect.pipe(Effect.flatMap((handler) => startBunHttpTransport({ handler }))),
    ).then((transport) => {
      const uploadUrl = `${transport.address}${assetUploadPath}`;
      return (
        // oxlint-disable-next-line effecttsgo/global-fetch -- [EH-282] integration test exercises multipart upload through the live HTTP listener.
        fetch(uploadUrl, { body: makeAcceptedUploadForm(), method: "POST" })
      )
        .then((response) => {
          expect(response.status).toBe(acceptedStatus);
          return Effect.runPromise(transport.close);
        })
        .then(() => {});
    });

export { verifyMultipartUploadOverLiveSocket };
