import {
  DevelopmentCms,
  Effect,
  HttpTransport,
  expect,
  payloadByteFive,
  payloadByteFour,
  payloadByteOne,
  payloadByteThree,
  payloadByteTwo,
  snapshot,
  startBunHttpTransport,
  successStatus,
} from "./http-socket-integration-backpressure-scenarios-imports.ts";

const assetHandlerEffect = HttpTransport.makeHandler({
    maximumMultipartFileByteLength: payloadByteFive,
    maximumMultipartMetadataByteLength: 256,
  }  ).pipe(
    // oxlint-disable-next-line effecttsgo/strict-effect-provide -- [EH-162] test entry point needs a fresh isolated layer.
    Effect.provide(DevelopmentCms.layer({ snapshot })),
  ),
  assetUploadPath = "api/v1/management/definition-spaces/example-blog/assets",
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
  readResponseBytesSlowly = (response: Response): Promise<Uint8Array> => {
    if (response.body === null) {
      throw new TypeError("Expected a streamed Asset response body");
    }
    const collectedBytes: number[] = [],
      reader = response.body.getReader(),
    // oxlint-disable-next-line effecttsgo/async-function -- [EH-071] slow consumer reads intentionally await Bun.sleep between stream chunks; readNextChunk closes over reader.
     readNextChunk = async (): Promise<Uint8Array> => {
      const chunk = await reader.read();
      if (chunk.done) {
        return new Uint8Array(collectedBytes);
      }
      collectedBytes.push(...chunk.value);
      await Bun.sleep(slowConsumerDelayMilliseconds);
      return readNextChunk();
    };
    return readNextChunk();
  },
  slowConsumerDelayMilliseconds = 5,
  verifySlowConsumerBackpressureOverLiveSocket = (): Promise<void> =>
    Effect.runPromise(
      assetHandlerEffect.pipe(Effect.flatMap((handler) => startBunHttpTransport({ handler }))),
    ).then((transport) => {
      const uploadUrl = `${transport.address}${assetUploadPath}`;
      return (
        // oxlint-disable-next-line effecttsgo/global-fetch -- [EH-112] integration test uploads an Asset through the live HTTP listener.
        fetch(uploadUrl, { body: makeAcceptedUploadForm(), method: "POST" })
      )
        .then((uploadResponse) => uploadResponse.json())
        .then((uploadBody: unknown) => {
          if (
            uploadBody === null ||
            typeof uploadBody !== "object" ||
            !("id" in uploadBody) ||
            typeof uploadBody["id"] !== "string"
          ) {
            throw new TypeError("Expected uploaded Asset identifier");
          }
          const contentUrl = `${transport.address}${assetUploadPath}/${uploadBody["id"]}/content`;
          return (
            // oxlint-disable-next-line effecttsgo/global-fetch -- [EH-110] integration test streams an Asset download through the live HTTP listener.
            fetch(contentUrl)
          )
            .then((downloadResponse) => {
              expect(downloadResponse.status).toBe(successStatus);
              return readResponseBytesSlowly(downloadResponse);
            })
            .then((downloadedBytes) => {
              expect(downloadedBytes).toEqual(
                new Uint8Array([
                  payloadByteOne,
                  payloadByteTwo,
                  payloadByteThree,
                  payloadByteFour,
                  payloadByteFive,
                ]),
              );
              return Effect.runPromise(transport.close);
            });
        })
        .then(() => {});
    });

export { verifySlowConsumerBackpressureOverLiveSocket };
