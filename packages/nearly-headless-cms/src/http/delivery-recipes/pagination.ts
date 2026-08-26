import { type ReadonlyTransportRequest, toWebRequest } from "../http-transport-readonly-types.ts";

/** Parsed cursor pagination values from a Delivery Query request. */
export interface PaginationFromRequest {
  readonly cursor: string | undefined;
  readonly pageSize: number;
}

/** Default and maximum page sizes for Delivery Query pagination. */
export const defaultDeliveryPageSize = 20,
  maximumDeliveryPageSize = 100;

// oxlint-disable-next-line eslint/one-var -- [EH-310] transport helpers stay in one local const block below exported pagination constants.
const requestUrlSearchParameter = (
    parameterName: string,
    request: ReadonlyTransportRequest,
  ): string | undefined => {
    const requestUrl = new URL(toWebRequest(request).url);
    return requestUrl.searchParams.get(parameterName) ?? undefined;
  },
  // oxlint-disable-next-line effecttsgo/missing-pipeable-signature -- [EH-295] pagination parsing is intentionally a direct transport helper.
  paginationFromRequest = (
    request: ReadonlyTransportRequest,
    defaultPageSize: number = defaultDeliveryPageSize,
  ): PaginationFromRequest => ({
    cursor: requestUrlSearchParameter("cursor", request),
    pageSize: Number(requestUrlSearchParameter("pageSize", request) ?? String(defaultPageSize)),
  }),
  // oxlint-disable-next-line effecttsgo/missing-pipeable-signature -- [EH-300] required path parameter lookup is intentionally a direct transport helper.
  requiredPathParameter = <
    Parameters extends Readonly<Record<string, string | undefined>>,
  >(
    parameters: Readonly<Parameters>,
    name: string,
  ): string => {
    const value = parameters[name];
    if (value === undefined) {
      throw new Error(`Missing required parameter: ${name}`);
    }
    return value;
  };

/** Reads cursor pagination query parameters from a Delivery Query request. */
export { paginationFromRequest };

/** Returns a required path parameter or throws when it is absent. */
export { requiredPathParameter };
