import { type Cms, CmsError, type ContentDefinition, type EntryQuery } from "nearly-headless-cms";
import { Effect, Schema } from "effect";
import { EmptyRequest, PageQuery } from "./wire-schemas.ts";
import type { HttpContract } from "nearly-headless-cms/http";

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
  readonly request: Request;
}

const requestUrlSearchParameter = <RequestType extends Request>(
    parameterName: string,
    request: Readonly<RequestType>,
  ): string | undefined => {
    const requestUrl = new URL(request.url);
    return requestUrl.searchParams.get(parameterName) ?? undefined;
  },
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
          return Effect.fail(CmsError.NotFound.make({ message: `${contentTypeId} was not found` }));
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
  parseBody = <RequestType extends Request>(
    request: Readonly<RequestType>,
  ): Effect.Effect<ContentDefinition.JsonObject, CmsError.InvalidInput> =>
    Effect.tryPromise({
      catch: (cause) => {
        if (Schema.is(CmsError.InvalidInput)(cause)) {
          return cause;
        }
        return CmsError.InvalidInput.make({ message: "Malformed Comment submission" });
      },
      try: () => {
        if (!(request.headers.get("content-type") ?? "").startsWith("application/json")) {
          return Promise.reject(
            CmsError.InvalidInput.make({ message: "Comment submission requires application/json" }),
          );
        }
        return request.json().then((value: unknown) => {
          if (!Schema.is(Schema.JsonObject)(value)) {
            throw CmsError.InvalidInput.make({ message: "Comment submission must be an object" });
          }
          return value;
        });
      },
    }),
  publicValue = (entry: {
    readonly id: string;
    readonly values: ContentDefinition.JsonObject;
  }): PublicValue => ({
    id: entry.id,
    ...Object.fromEntries(
      Object.entries(entry.values).map(([key, value]) => [lowerCamelCase(key), value]),
    ),
  }),
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
  // oxlint-disable-next-line effecttsgo/missing-pipeable-signature -- local schema adapter is intentionally direct-call only.
  readSchemas = <
    ResponseSchema extends HttpContract.OperationSchema,
    PathParameters extends Record<string, HttpContract.OperationSchema>,
  >(
    response: Readonly<ResponseSchema>,
    pathParameters: Readonly<PathParameters> = {},
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
