// oxlint-disable-next-line effecttsgo/extends-native-error -- [EH-074] This transport-only error is converted to a CmsError before entering an Effect failure channel.
export class RequestFailureError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "RequestFailureError";
    this.code = code;
    this.status = status;
  }
}
