import type { ContentDefinition} from "nearly-headless-cms";
import { CmsError } from "nearly-headless-cms";
import {
  findEntryBySlug,
  publicEntryValue as projectPublicEntryValue,
  queryEntryPage,
  queryEveryEntry,
  readDeliverySchemas,
  requiredPathParameter,
  toWebRequest,
} from "nearly-headless-cms/http";
import type { HttpContract } from "nearly-headless-cms/http";
import { Effect, Schema } from "effect";
import { EmptyRequest, PageQuery } from "../shared/wire-schemas.ts";
import type { ReadonlyTransportRequest } from "nearly-headless-cms/http";

export type PublicValue = ContentDefinition.JsonObject;

/** Nullable public wire fields keyed by Content Type identifier. */
export const publicNullableWireFields: Readonly<Record<string, readonly string[]>> = {
  author: ["portrait", "portraitAlternativeText", "profile"],
  category: ["description"],
  comment: ["websiteUrl"],
  guide: ["nextGuide"],
  post: ["featuredAlternativeText", "featuredAsset"],
  tag: ["description"],
};

export const publicEntryValueOptions = { nullableWireFields: publicNullableWireFields },
  DEFAULT_PAGE_SIZE = 20,
  FIRST_INDEX = 0,
  MAX_PUBLIC_EXPORT_BYTES = 5_000_000,
  MAX_QUERY_PAGE_SIZE = 100,
  ONE_ITEM = 1,
  canonicalizeJsonValue = (value: unknown): unknown => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return value;
    }
    return Object.fromEntries(
      Object.entries(value)
        .toSorted(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
        .map(([key, child]) => [key, canonicalizeJsonValue(child)]),
    );
  },
  findBySlug = (
    input: Omit<Parameters<typeof findEntryBySlug>[0], "publicEntryValueOptions">,
  ) => findEntryBySlug({ ...input, publicEntryValueOptions }),
  parseBody = (
    request: ReadonlyTransportRequest,
  ): Effect.Effect<ContentDefinition.JsonObject, CmsError.InvalidInput> =>
    Effect.tryPromise({
      catch: (cause) => {
        if (Schema.is(CmsError.InvalidInput)(cause)) {
          return cause;
        }
        return CmsError.InvalidInput.make({ message: "Malformed Comment submission" });
      },
      try: () => {
        const webRequest = toWebRequest(request);
        if (!(webRequest.headers.get("content-type") ?? "").startsWith("application/json")) {
          return Promise.reject(
            CmsError.InvalidInput.make({ message: "Comment submission requires application/json" }),
          );
        }
        return webRequest.json().then((value: unknown) => {
          if (!Schema.is(Schema.JsonObject)(value)) {
            throw CmsError.InvalidInput.make({ message: "Comment submission must be an object" });
          }
          return value;
        });
      },
    }),
  publicValue = (
    entry: Parameters<typeof projectPublicEntryValue>[0],
  ): PublicValue => projectPublicEntryValue(entry, publicEntryValueOptions),
  queryAll = queryEveryEntry,
  queryPage = (
    input: Omit<Parameters<typeof queryEntryPage>[0], "publicEntryValueOptions">,
  ) => queryEntryPage({ ...input, publicEntryValueOptions });

// oxlint-disable-next-line effecttsgo/missing-pipeable-signature -- [EH-305] Example CMS readSchemas is a thin DeliveryRecipes wrapper.
export const readSchemas = (
  response: HttpContract.OperationSchema,
  pathParameters: Record<string, HttpContract.OperationSchema> = {},
  includePagination = false,
): HttpContract.OperationSchemas =>
  readDeliverySchemas({
    includePagination,
    pageQuery: PageQuery,
    pathParameters,
    request: EmptyRequest,
    response,
  });

// oxlint-disable-next-line effecttsgo/missing-pipeable-signature -- [EH-306] Example CMS requiredParameter is a thin DeliveryRecipes wrapper.
export const requiredParameter = requiredPathParameter;

export default {
  canonicalizeJsonValue,
  findBySlug,
  parseBody,
  publicValue,
  queryAll,
  queryPage,
  readSchemas,
  requiredParameter,
};
