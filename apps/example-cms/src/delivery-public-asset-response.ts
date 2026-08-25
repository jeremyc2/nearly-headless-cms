import deliveryPublicAssetResponseSupport, {
  type PublicAssetResponseInput,
} from "./delivery-public-asset-response-support.ts";

const { publicAssetBody, publicAssetHeaders, rangeNotModifiedResponse, rangedAssetResponse } =
    deliveryPublicAssetResponseSupport,
  publicAssetResponse = (input: PublicAssetResponseInput): Response => {
    const { asset, request } = input,
      { etag, headers } = publicAssetHeaders(input),
      ifRangeMismatch = rangeNotModifiedResponse(request, asset, headers),
      range = request.headers.get("range");
    if (request.headers.get("if-none-match") === etag) {
      return new Response(null, { headers, status: 304 });
    }
    if (ifRangeMismatch !== undefined) {
      return ifRangeMismatch;
    }
    if (range !== null) {
      return rangedAssetResponse({ asset, headers, range, request });
    }
    return new Response(publicAssetBody(request, new Uint8Array(asset.bytes)), {
      headers,
      status: 200,
    });
  };

export default {
  publicAssetResponse,
};
