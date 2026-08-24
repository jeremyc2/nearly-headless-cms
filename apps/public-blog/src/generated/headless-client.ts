import { Effect, Schema } from "effect";

export const generatorFormatVersion = 1;

export interface PublicPost {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly excerpt: string;
  readonly body: RichTextDocument;
  readonly featuredAsset: string | null;
  readonly featuredAlternativeText: string | null;
  readonly author: string;
  readonly categories: readonly string[];
  readonly tags: readonly string[];
  readonly status: "published";
  readonly publishedAt: string;
}

export interface PublicAuthor {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly biography: string;
  readonly profile: RichTextDocument | null;
  readonly portrait: string | null;
  readonly portraitAlternativeText: string | null;
}
export interface PublicTaxonomy {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
}
export interface PublicComment {
  readonly id: string;
  readonly post: string;
  readonly displayName: string;
  readonly websiteUrl: string | null;
  readonly body: string;
  readonly createdAt: string;
  readonly status: "approved";
}
export interface PublicAsset {
  readonly id: string;
  readonly metadata: {
    readonly filename: string;
    readonly mediaType: string;
    readonly byteLength: number;
    readonly digest: string;
    readonly width?: number;
    readonly height?: number;
    readonly defaultAlternativeText?: string;
  };
  readonly localPath?: string;
}
export interface RichTextDocument {
  readonly format: "nearly-headless-cms/rich-text";
  readonly version: 1;
  readonly children: readonly RichTextNode[];
}
export interface RichTextNode {
  readonly type: string;
  readonly text?: string;
  readonly marks?: readonly string[];
  readonly level?: number;
  readonly url?: string;
  readonly entryId?: string;
  readonly assetId?: string;
  readonly alternativeText?: string;
  readonly caption?: string;
  readonly children?: readonly RichTextNode[];
}

export interface PublicBlogExport {
  readonly definitionFingerprint: string;
  readonly generatedAt: string;
  readonly posts: readonly PublicPost[];
  readonly authors: readonly PublicAuthor[];
  readonly categories: readonly PublicTaxonomy[];
  readonly tags: readonly PublicTaxonomy[];
  readonly comments: readonly PublicComment[];
  readonly assets: readonly PublicAsset[];
}

export class TransportFailure extends Schema.TaggedError<TransportFailure>()("TransportFailure", {
  message: Schema.String,
}) {}
export class ProtocolFailure extends Schema.TaggedError<ProtocolFailure>()("ProtocolFailure", {
  message: Schema.String,
  status: Schema.Number,
}) {}
export class UnsupportedDefinition extends Schema.TaggedError<UnsupportedDefinition>()(
  "UnsupportedDefinition",
  { message: Schema.String },
) {}
export class DeclaredFailure extends Schema.TaggedError<DeclaredFailure>()("DeclaredFailure", {
  code: Schema.String,
  message: Schema.String,
  status: Schema.Number,
}) {}

const fetchJson = <Value>(
  url: string,
  init?: RequestInit,
): Effect.Effect<Value, TransportFailure | ProtocolFailure | DeclaredFailure> =>
  Effect.tryPromise({
    catch: (cause) =>
      cause instanceof TransportFailure ||
      cause instanceof ProtocolFailure ||
      cause instanceof DeclaredFailure
        ? cause
        : new TransportFailure({
            message: cause instanceof Error ? cause.message : "Headless request failed",
          }),
    try: async () => {
      let response: Response;
      try {
        response = await fetch(url, init);
      } catch (cause) {
        throw new TransportFailure({
          message: cause instanceof Error ? cause.message : "Connection failed",
        });
      }
      const mediaType = response.headers.get("content-type") ?? "";
      if (!response.ok) {
        if (mediaType.includes("application/json")) {
          const error = (await response.json()) as {
            readonly code?: string;
            readonly message?: string;
          };
          throw new DeclaredFailure({
            code: error.code ?? "Unknown",
            message: error.message ?? "Headless operation failed",
            status: response.status,
          });
        }
        throw new ProtocolFailure({
          message: `Unexpected Headless response ${response.status}`,
          status: response.status,
        });
      }
      if (!mediaType.includes("application/json"))
        throw new ProtocolFailure({
          message: "Expected a JSON Headless response",
          status: response.status,
        });
      try {
        return (await response.json()) as Value;
      } catch {
        throw new ProtocolFailure({
          message: "Malformed Headless JSON response",
          status: response.status,
        });
      }
    },
  });

export const makeHeadlessClient = (baseUrl: string) => ({
  discover: (): Effect.Effect<
    Readonly<Record<string, unknown>>,
    TransportFailure | ProtocolFailure | DeclaredFailure
  > => fetchJson(`${baseUrl}/api/v1/headless/schema`),
  exportPublicBlog: (
    expectedFingerprint: string,
  ): Effect.Effect<PublicBlogExport, TransportFailure | ProtocolFailure | DeclaredFailure> =>
    fetchJson(`${baseUrl}/api/v1/headless/export`, {
      headers: { "cms-expected-definition-fingerprint": expectedFingerprint },
    }),
  submitComment: (
    postId: string,
    input: {
      readonly displayName: string;
      readonly websiteUrl: string | null;
      readonly body: string;
    },
    idempotencyKey: string,
  ): Effect.Effect<
    { readonly submissionId: string; readonly status: "pending" },
    TransportFailure | ProtocolFailure | DeclaredFailure
  > =>
    fetchJson(`${baseUrl}/api/v1/headless/posts/${encodeURIComponent(postId)}/comments`, {
      body: JSON.stringify(input),
      headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
      method: "POST",
    }),
});
