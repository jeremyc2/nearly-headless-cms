import type { ConsistentReadSnapshot, ServiceShape as CmsServiceShape } from "../../cms.ts";
import { NotFound, type CmsError } from "../../cms-error.ts";
import type { JsonObject } from "../../content-definition-types.ts";
import type { Predicate, Sort } from "../../entry-query.ts";
import { Effect } from "effect";
import type { DeliveryOperation, OperationSchema, OperationSchemas } from "../http-contract.ts";
import type { ReadonlyTransportRequest } from "../http-transport-readonly-types.ts";
import type { DefinitionRequirement } from "../../operation.ts";
import { paginationFromRequest, requiredPathParameter } from "./pagination.ts";
import { type PublicEntryValueOptions, publicEntryPage, publicEntryValue } from "./public-entry-value.ts";

/** Options for building read-only Delivery Query Operation Schemas. */
export interface ReadDeliverySchemasOptions {
  readonly includePagination?: boolean;
  readonly pageQuery?: Readonly<Record<string, OperationSchema>>;
  readonly pathParameters?: Readonly<Record<string, OperationSchema>>;
  readonly request: OperationSchema;
  readonly response: OperationSchema;
}

/** Input for querying every Entry that matches a predicate. */
export interface QueryEveryEntryInput {
  readonly cms: Readonly<CmsServiceShape>;
  readonly contentTypeId: string;
  readonly sort?: readonly Sort[];
  readonly where?: Predicate;
}

/** Input for querying one paginated Entry page from a transport request. */
export interface QueryEntryPageInput extends QueryEveryEntryInput {
  readonly publicEntryValueOptions?: PublicEntryValueOptions;
  readonly request: ReadonlyTransportRequest;
}

/** Input for finding one Entry by slug. */
export interface FindEntryBySlugInput {
  readonly cms: Readonly<CmsServiceShape>;
  readonly contentTypeId: string;
  readonly publicEntryValueOptions?: PublicEntryValueOptions;
  readonly publicOnly?: boolean;
  readonly publishedStatusValue?: string;
  readonly slug: string;
  readonly statusFieldPath?: string;
}

/** Options for a paginated Delivery Query declaration. */
export interface PaginatedDeliveryQueryOptions {
  readonly contentTypeId: string;
  readonly definitionRequirements: readonly DefinitionRequirement[];
  readonly identifier: string;
  readonly path: `/${string}`;
  readonly pathParameters?: Readonly<Record<string, OperationSchema>>;
  readonly publicEntryValueOptions?: PublicEntryValueOptions;
  readonly reachableContentTypeIds: readonly string[];
  readonly request: OperationSchema;
  readonly response: OperationSchema;
  readonly pageQuery: Readonly<Record<string, OperationSchema>>;
  readonly sort?: readonly Sort[];
  readonly where?: Predicate;
}

/** Options for a slug-based Delivery Query declaration. */
export interface EntryBySlugDeliveryQueryOptions {
  readonly contentTypeId: string;
  readonly definitionRequirements: readonly DefinitionRequirement[];
  readonly identifier: string;
  readonly path: `/${string}`;
  readonly pathParameterName?: string;
  readonly pathParameterSchema: OperationSchema;
  readonly publicEntryValueOptions?: PublicEntryValueOptions;
  readonly publicOnly?: boolean;
  readonly publishedStatusValue?: string;
  readonly reachableContentTypeIds: readonly string[];
  readonly request: OperationSchema;
  readonly response: OperationSchema;
  readonly statusFieldPath?: string;
}

const firstIndex = 0,
  maximumQueryPageSize = 100,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-304] OperationSchema values include Effect Schema classes that are not deeply readonly.
  readDeliverySchemas = (options: Readonly<ReadDeliverySchemasOptions>): OperationSchemas => {
    const pathParameters = options.pathParameters ?? {};
    if (options.includePagination === true) {
      if (options.pageQuery === undefined) {
        throw new Error("pageQuery is required when includePagination is true");
      }
      return {
        pathParameters,
        queryParameters: options.pageQuery,
        request: options.request,
        response: options.response,
      };
    }
    return { pathParameters, request: options.request, response: options.response };
  },
  queryEveryEntry = ({
    cms,
    contentTypeId,
    sort,
    where,
  }: Readonly<QueryEveryEntryInput>): Effect.Effect<
    readonly ConsistentReadSnapshot["entries"][number][],
    CmsError
  > =>
    Effect.gen(function* queryEveryEntryEffect() {
      const entries: ConsistentReadSnapshot["entries"][number][] = [];
      let nextCursor = undefined as string | undefined;
      for (;;) {
        const page = yield* cms.queryEntries({
          contentTypeId,
          cursor: nextCursor,
          pageSize: maximumQueryPageSize,
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
  // oxlint-disable-next-line effecttsgo/missing-pipeable-signature -- [EH-301] paginated Entry page reads are intentionally direct CMS service helpers.
  queryEntryPage = ({
    cms,
    contentTypeId,
    publicEntryValueOptions,
    request,
    sort,
    where,
  }: Readonly<QueryEntryPageInput>): Effect.Effect<
    { items: readonly JsonObject[]; nextCursor?: string },
    CmsError
  > => {
    const { cursor, pageSize } = paginationFromRequest(request);
    return cms
      .queryEntries({ contentTypeId, cursor, pageSize, sort, where })
      .pipe(Effect.map((page) => publicEntryPage(page, publicEntryValueOptions)));
  },
  // oxlint-disable-next-line effecttsgo/missing-pipeable-signature -- [EH-302] slug Entry lookup is intentionally a direct CMS service helper.
  findEntryBySlug = ({
    cms,
    contentTypeId,
    publicEntryValueOptions,
    publicOnly = false,
    publishedStatusValue = "published",
    slug,
    statusFieldPath = "status",
  }: Readonly<FindEntryBySlugInput>): Effect.Effect<JsonObject, CmsError> => {
    let where: Predicate = { operator: "equals", path: "slug", value: slug };
    if (publicOnly) {
      where = {
        all: [
          { operator: "equals", path: "slug", value: slug },
          { operator: "equals", path: statusFieldPath, value: publishedStatusValue },
        ],
      };
    }
    return queryEveryEntry({ cms, contentTypeId, where }).pipe(
      Effect.flatMap((entries) => {
        const firstEntry = entries[firstIndex];
        if (firstEntry === undefined) {
          return NotFound.make({ message: `${contentTypeId} was not found` });
        }
        return Effect.succeed(publicEntryValue(firstEntry, publicEntryValueOptions));
      }),
    );
  },
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-303] Delivery Query builders accept Effect Schema classes that are not deeply readonly.
  paginatedDeliveryQuery = (options: Readonly<PaginatedDeliveryQueryOptions>): DeliveryOperation => ({
    definitionRequirements: options.definitionRequirements,
    execute: ({ cms, request }) =>
      queryEntryPage({
        cms,
        contentTypeId: options.contentTypeId,
        publicEntryValueOptions: options.publicEntryValueOptions,
        request,
        sort: options.sort,
        where: options.where,
      }),
    identifier: options.identifier,
    method: "GET",
    path: options.path,
    reachableContentTypeIds: options.reachableContentTypeIds,
    schemas: readDeliverySchemas({
      includePagination: true,
      pageQuery: options.pageQuery,
      pathParameters: options.pathParameters,
      request: options.request,
      response: options.response,
    }),
  }),
  entryBySlugDeliveryQuery = (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-303] Delivery Query builders accept Effect Schema classes that are not deeply readonly.
    options: Readonly<EntryBySlugDeliveryQueryOptions>,
  ): DeliveryOperation => {
    const pathParameterName = options.pathParameterName ?? "slug";
    return {
      definitionRequirements: options.definitionRequirements,
      execute: ({ cms, parameters }) =>
        findEntryBySlug({
          cms,
          contentTypeId: options.contentTypeId,
          publicEntryValueOptions: options.publicEntryValueOptions,
          publicOnly: options.publicOnly,
          publishedStatusValue: options.publishedStatusValue,
          slug: requiredPathParameter(parameters, pathParameterName),
          statusFieldPath: options.statusFieldPath,
        }),
      identifier: options.identifier,
      method: "GET",
      path: options.path,
      reachableContentTypeIds: options.reachableContentTypeIds,
      schemas: readDeliverySchemas({
        pathParameters: { [pathParameterName]: options.pathParameterSchema },
        request: options.request,
        response: options.response,
      }),
    };
  };

/** Builds read-only Operation Schemas for a Delivery Query. */
export { readDeliverySchemas };

/** Queries every Entry page for one Content Type predicate. */
export { queryEveryEntry };

/** Queries one paginated Entry page and projects public wire values. */
export { queryEntryPage };

/** Finds one Entry by slug and projects a public wire value. */
export { findEntryBySlug };

/** Declares one paginated Delivery Query bound to Entry Query behavior. */
export { paginatedDeliveryQuery };

/** Declares one slug-based Delivery Query bound to Entry Query behavior. */
export { entryBySlugDeliveryQuery };
