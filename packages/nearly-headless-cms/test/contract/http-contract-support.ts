import { type CompiledSnapshot, compileSnapshot } from "../../src/content-definition.ts";

export const acceptedStatus = 201,
  badRequestStatus = 400,
  contentTooLargeStatus = 413,
  createdStatus = 201,
  headerLengthLimit = 120,
  headerTooLargeStatus = 431,
  isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    value !== null && typeof value === "object" && !Array.isArray(value),
  maximumHeaderByteLength = 100,
  maximumJsonBodyByteLength = 24,
  methodNotAllowedStatus = 405,
  noContentStatus = 204,
  notAcceptableStatus = 406,
  notFoundStatus = 404,
  payloadByteFive = 5,
  payloadByteFour = 4,
  payloadByteOne = 1,
  payloadByteSix = 6,
  payloadByteThree = 3,
  payloadByteTwo = 2,
  readJsonCode = (response: Response): Promise<string> =>
    response.json().then((body: unknown) => {
      if (!isRecord(body) || typeof body["code"] !== "string") {
        throw new TypeError("Expected an error response with a string code");
      }
      return body["code"];
    }),
  requestTimeoutMilliseconds = 5,
  requestTimeoutStatus = 408,
  snapshot: CompiledSnapshot = compileSnapshot({
    definitionSpaceId: "example-blog",
    definitions: [
      {
        fields: [{ key: "title", kind: { kind: "text" }, label: "Title", required: true }],
        id: "post",
        kind: "contentType",
        name: "Post",
      },
    ],
    snapshotId: "initial",
  }),
  successStatus = 200,
  unsupportedMediaTypeStatus = 415,
  uriTooLongStatus = 414,
  urlLengthLimit = 150;
