import { Effect, Schema } from "effect";

export const generatorFormatVersion = 1;

export interface EntryRepresentation {
  readonly id: string;
  readonly contentTypeId: string;
  readonly values: Readonly<Record<string, unknown>>;
}

export interface QueryPage {
  readonly items: readonly EntryRepresentation[];
  readonly nextCursor?: string;
}

export class ManagementClientFailure extends Schema.TaggedError<ManagementClientFailure>()(
  "ManagementClientFailure",
  {
    code: Schema.optional(Schema.String),
    message: Schema.String,
    status: Schema.Number,
  },
) {}

const request = <Value>(
  baseUrl: string,
  path: string,
  init?: RequestInit,
): Effect.Effect<Value, ManagementClientFailure> =>
  Effect.tryPromise({
    catch: (cause) =>
      cause instanceof ManagementClientFailure
        ? cause
        : ManagementClientFailure.make({
            message: cause instanceof Error ? cause.message : "Management transport failed",
            status: 0,
          }),
    try: async () => {
      const response = await fetch(`${baseUrl}${path}`, init);
      if (!response.ok) {
        const error = (await response.json().catch(() => ({}))) as {
          readonly code?: string;
          readonly message?: string;
        };
        throw ManagementClientFailure.make({
          code: error.code,
          message: error.message ?? `Management request failed with ${response.status}`,
          status: response.status,
        });
      }
      return response.status === 204 ? (undefined as Value) : ((await response.json()) as Value);
    },
  });

export const makeManagementClient = (baseUrl = "") => ({
  createEntry: (
    contentTypeId: string,
    values: Readonly<Record<string, unknown>>,
  ): Effect.Effect<
    | EntryRepresentation
    | {
        readonly entry: EntryRepresentation;
        readonly writeToken: string;
        readonly revisionNumber: number;
      },
    ManagementClientFailure
  > =>
    request(
      baseUrl,
      `/api/v1/management/definition-spaces/example-blog/content-types/${encodeURIComponent(contentTypeId)}/entries`,
      {
        body: JSON.stringify({ values }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    ),
  getCurrentState: (
    contentTypeId: string,
    entryId: string,
  ): Effect.Effect<
    {
      readonly entry: EntryRepresentation;
      readonly writeToken: string;
      readonly revisionNumber: number;
    },
    ManagementClientFailure
  > =>
    request(
      baseUrl,
      `/api/v1/management/definition-spaces/example-blog/content-types/${encodeURIComponent(contentTypeId)}/entries/${encodeURIComponent(entryId)}/state`,
    ),
  getEntry: (
    contentTypeId: string,
    entryId: string,
  ): Effect.Effect<EntryRepresentation, ManagementClientFailure> =>
    request(
      baseUrl,
      `/api/v1/management/definition-spaces/example-blog/content-types/${encodeURIComponent(contentTypeId)}/entries/${encodeURIComponent(entryId)}`,
    ),
  inspectRevision: (
    contentTypeId: string,
    entryId: string,
    revisionNumber: number,
  ): Effect.Effect<
    {
      readonly revisionNumber: number;
      readonly recordedAt: string;
      readonly values: Readonly<Record<string, unknown>>;
    },
    ManagementClientFailure
  > =>
    request(
      baseUrl,
      `/api/v1/management/definition-spaces/example-blog/content-types/${encodeURIComponent(contentTypeId)}/entries/${encodeURIComponent(entryId)}/revisions/${revisionNumber}`,
    ),
  listAssets: (): Effect.Effect<ReadonlyArray<unknown>, ManagementClientFailure> =>
    request(baseUrl, "/api/v1/management/definition-spaces/example-blog/assets"),
  listRevisions: (
    contentTypeId: string,
    entryId: string,
  ): Effect.Effect<
    {
      readonly items: ReadonlyArray<{
        readonly revisionNumber: number;
        readonly recordedAt: string;
      }>;
    },
    ManagementClientFailure
  > =>
    request(
      baseUrl,
      `/api/v1/management/definition-spaces/example-blog/content-types/${encodeURIComponent(contentTypeId)}/entries/${encodeURIComponent(entryId)}/revisions?pageSize=20`,
    ),
  queryEntries: (
    contentTypeId: string,
    query: Readonly<Record<string, unknown>>,
  ): Effect.Effect<QueryPage, ManagementClientFailure> =>
    request(
      baseUrl,
      `/api/v1/management/definition-spaces/example-blog/content-types/${encodeURIComponent(contentTypeId)}/entries/query`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(query),
      },
    ),
  replaceEntry: (
    contentTypeId: string,
    entryId: string,
    values: Readonly<Record<string, unknown>>,
    writeToken?: string,
  ): Effect.Effect<
    | EntryRepresentation
    | {
        readonly entry: EntryRepresentation;
        readonly writeToken: string;
        readonly revisionNumber: number;
      },
    ManagementClientFailure
  > =>
    request(
      baseUrl,
      `/api/v1/management/definition-spaces/example-blog/content-types/${encodeURIComponent(contentTypeId)}/entries/${encodeURIComponent(entryId)}`,
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          ...(writeToken === undefined ? {} : { "cms-write-token": writeToken }),
        },
        body: JSON.stringify({ values }),
      },
    ),
  restoreRevision: (
    contentTypeId: string,
    entryId: string,
    revisionNumber: number,
    writeToken: string,
  ): Effect.Effect<
    {
      readonly entry: EntryRepresentation;
      readonly writeToken: string;
      readonly revisionNumber: number;
    },
    ManagementClientFailure
  > =>
    request(
      baseUrl,
      `/api/v1/management/definition-spaces/example-blog/content-types/${encodeURIComponent(contentTypeId)}/entries/${encodeURIComponent(entryId)}/restorations`,
      {
        body: JSON.stringify({ revisionNumber, writeToken }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    ),
  runEditorialCommand: (
    contentTypeId: "post" | "comment",
    entryId: string,
    status: "draft" | "published" | "approved" | "rejected",
    writeToken: string,
  ): Effect.Effect<
    {
      readonly entry: EntryRepresentation;
      readonly writeToken: string;
      readonly revisionNumber: number;
    },
    ManagementClientFailure
  > => {
    const operation =
      contentTypeId === "post"
        ? status === "published"
          ? "publications"
          : "draft-returns"
        : status === "approved"
          ? "approvals"
          : "rejections";
    return request(
      baseUrl,
      `/api/v1/management/definition-spaces/example-blog/operations/${contentTypeId}s/${encodeURIComponent(entryId)}/${operation}`,
      {
        headers: { "cms-write-token": writeToken },
        method: "POST",
      },
    );
  },
  uploadAsset: (file: File): Effect.Effect<unknown, ManagementClientFailure> => {
    const form = new FormData();
    form.set(
      "metadata",
      JSON.stringify({ filename: file.name, mediaType: file.type || "application/octet-stream" }),
    );
    form.set("content", file);
    return request(baseUrl, "/api/v1/management/definition-spaces/example-blog/assets", {
      body: form,
      method: "POST",
    });
  },
});
