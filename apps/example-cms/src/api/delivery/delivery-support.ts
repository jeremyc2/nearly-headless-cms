import { type Cms, CmsError, type ContentDefinition, type EntryQuery } from "nearly-headless-cms";
import { Effect, Schema } from "effect";
import { EmptyRequest, PageQuery } from "../shared/wire-schemas.ts";
import {
  type HttpContract,
  type ReadonlyTransportRequest,
  toWebRequest,
} from "nearly-headless-cms/http";

export type PublicValue = ContentDefinition.JsonObject;

export interface FindBySlugInput {
  readonly cms: Readonly<Cms.ServiceShape>;
  readonly contentTypeId: string;
  readonly publicOnly?: boolean;
  readonly slug: string;
}

export interface QueryEntriesInput {
  readonly cms: Readonly<Cms.ServiceShape>;
  readonly contentTypeId: string;
  readonly sort?: readonly EntryQuery.Sort[];
  readonly where?: EntryQuery.Predicate;
}

export interface QueryPageInput extends QueryEntriesInput {
  readonly request: ReadonlyTransportRequest;
}

const requestUrlSearchParameter = (
    parameterName: string,
    request: ReadonlyTransportRequest,
  ): string | undefined => {
    const requestUrl = new URL(toWebRequest(request).url);
    return requestUrl.searchParams.get(parameterName) ?? undefined;
  },
  DEFAULT_PAGE_SIZE = 20,
  FIRST_INDEX = 0,
  MAX_PUBLIC_EXPORT_BYTES = 5_000_000,
  MAX_QUERY_PAGE_SIZE = 100,
  ONE_ITEM = 1,
  publicNullableWireFields: Readonly<Record<string, readonly string[]>> = {
    author: ["portrait", "portraitAlternativeText", "profile"],
    category: ["description"],
    comment: ["websiteUrl"],
    guide: ["nextGuide"],
    post: ["featuredAlternativeText", "featuredAsset"],
    tag: ["description"],
  },
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
  findBySlug = ({ cms, contentTypeId, publicOnly = false, slug }: Readonly<FindBySlugInput>) => {
    let where: EntryQuery.Predicate = { operator: "equals", path: "slug", value: slug };
    if (publicOnly) {
      where = {
        all: [
          { operator: "equals", path: "slug", value: slug },
          { operator: "equals", path: "status", value: "published" },
        ],
      };
    }
    return queryAll({ cms, contentTypeId, where }).pipe(
      Effect.flatMap((entries) => {
        const firstEntry = entries[FIRST_INDEX];
        if (firstEntry === undefined) {
          return CmsError.NotFound.make({ message: `${contentTypeId} was not found` });
        }
        return Effect.succeed(publicValue(firstEntry));
      }),
    );
  },
  lowerCamelCase = (key: string): string =>
    key.replaceAll(/-(?<letter>[a-z])/gu, (_match, letter: string) => letter.toUpperCase()),
  mapQueryPage = <
    Page extends {
      items: readonly Cms.ConsistentReadSnapshot["entries"][number][];
      nextCursor?: string;
    },
  >(
    page: Readonly<Page>,
  ) => {
    if (page.nextCursor !== undefined) {
      return { items: page.items.map(publicValue), nextCursor: page.nextCursor };
    }
    return { items: page.items.map(publicValue) };
  },
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
  publicValue = (entry: {
    readonly contentTypeId?: string;
    readonly id: string;
    readonly values: ContentDefinition.JsonObject;
  }): PublicValue => {
    const value: Record<string, ContentDefinition.JsonValue> = { id: entry.id };
    for (const [key, fieldValue] of Object.entries(entry.values)) {
      value[lowerCamelCase(key)] = fieldValue;
    }
    if (entry.contentTypeId !== undefined) {
      for (const nullableKey of publicNullableWireFields[entry.contentTypeId] ?? []) {
        if (!(nullableKey in value)) {
          value[nullableKey] = null;
        }
      }
    }
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- [EH-292] Wire values are assembled from validated Entry fields and explicit null defaults.
    return value;
  },
  queryAll = ({
    cms,
    contentTypeId,
    sort,
    where,
  }: Readonly<QueryEntriesInput>): Effect.Effect<
    readonly Cms.ConsistentReadSnapshot["entries"][number][],
    CmsError.CmsError
  > =>
    Effect.gen(function* queryEveryPage() {
      const entries: Cms.ConsistentReadSnapshot["entries"][number][] = [];
      let nextCursor = undefined as string | undefined;
      for (;;) {
        const page: EntryQuery.QueryPage = yield* cms.queryEntries({
          contentTypeId,
          cursor: nextCursor,
          pageSize: MAX_QUERY_PAGE_SIZE,
          sort,
          where,
        });
        entries.push(...page.items);
        ({ nextCursor } = page);
        if (nextCursor === undefined) {
          return entries;
        }
      }
    }),
  queryPage = <Input extends QueryPageInput>(input: Readonly<Input>) => {
    const { cms, contentTypeId, request, sort, where } = input,
      cursor = requestUrlSearchParameter("cursor", request),
      pageSize = Number(
        requestUrlSearchParameter("pageSize", request) ?? String(DEFAULT_PAGE_SIZE),
      );
    return cms
      .queryEntries({ contentTypeId, cursor, pageSize, sort, where })
      .pipe(Effect.map(mapQueryPage));
  },
  // oxlint-disable-next-line effecttsgo/missing-pipeable-signature -- [EH-126] local schema adapter is intentionally direct-call only.
  readSchemas = (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-262] OperationSchema values include Effect Schema classes that are not deeply readonly.
    response: HttpContract.OperationSchema,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-263] path parameter schemas include Effect Schema classes that are not deeply readonly.
    pathParameters: Record<string, HttpContract.OperationSchema> = {},
    includePagination = false,
  ): HttpContract.OperationSchemas => {
    if (includePagination) {
      return { pathParameters, queryParameters: PageQuery, request: EmptyRequest, response };
    }
    return { pathParameters, request: EmptyRequest, response };
  },
  requiredParameter = <Parameters extends Readonly<Record<string, string | undefined>>>(
    parameters: Readonly<Parameters>,
    name: string,
  ): string => {
    const value = parameters[name];
    if (value === undefined) {
      throw new Error(`Missing required parameter: ${name}`);
    }
    return value;
  };

export { DEFAULT_PAGE_SIZE, FIRST_INDEX, MAX_PUBLIC_EXPORT_BYTES, MAX_QUERY_PAGE_SIZE, ONE_ITEM };

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
