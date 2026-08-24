import { Effect, Schema } from "effect";
import {
  DeclaredFailure,
  ProtocolFailure,
  TransportFailure,
  makeGeneratedClient,
} from "./headless-openapi-client.ts";

export { DeclaredFailure, ProtocolFailure, TransportFailure };

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
  readonly externalLinks: readonly Readonly<Record<string, unknown>>[];
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

export class UnsupportedDefinition extends Schema.TaggedError<UnsupportedDefinition>()(
  "UnsupportedDefinition",
  { message: Schema.String },
) {}
const RichTextNodeSchema: Schema.Codec<RichTextNode> = Schema.Struct({
    alternativeText: Schema.optionalKey(Schema.String),
    assetId: Schema.optionalKey(Schema.String),
    caption: Schema.optionalKey(Schema.String),
    children: Schema.optionalKey(
      Schema.Array(Schema.suspend((): Schema.Codec<RichTextNode> => RichTextNodeSchema)),
    ),
    entryId: Schema.optionalKey(Schema.String),
    level: Schema.optionalKey(Schema.Number),
    marks: Schema.optionalKey(Schema.Array(Schema.String)),
    text: Schema.optionalKey(Schema.String),
    type: Schema.String,
    url: Schema.optionalKey(Schema.String),
  }),
  RichTextDocumentSchema: Schema.Codec<RichTextDocument> = Schema.Struct({
    children: Schema.Array(RichTextNodeSchema),
    format: Schema.Literal("nearly-headless-cms/rich-text"),
    version: Schema.Literal(1),
  }),
  PublicPostSchema: Schema.Codec<PublicPost> = Schema.Struct({
    author: Schema.String,
    body: RichTextDocumentSchema,
    categories: Schema.Array(Schema.String),
    excerpt: Schema.String,
    featuredAlternativeText: Schema.NullOr(Schema.String),
    featuredAsset: Schema.NullOr(Schema.String),
    id: Schema.String,
    publishedAt: Schema.String,
    slug: Schema.String,
    status: Schema.Literal("published"),
    tags: Schema.Array(Schema.String),
    title: Schema.String,
  }),
  PublicAuthorSchema: Schema.Codec<PublicAuthor> = Schema.Struct({
    biography: Schema.String,
    externalLinks: Schema.Array(Schema.JsonObject),
    id: Schema.String,
    name: Schema.String,
    portrait: Schema.NullOr(Schema.String),
    portraitAlternativeText: Schema.NullOr(Schema.String),
    profile: Schema.NullOr(RichTextDocumentSchema),
    slug: Schema.String,
  }),
  PublicTaxonomySchema: Schema.Codec<PublicTaxonomy> = Schema.Struct({
    description: Schema.NullOr(Schema.String),
    id: Schema.String,
    name: Schema.String,
    slug: Schema.String,
  }),
  PublicCommentSchema: Schema.Codec<PublicComment> = Schema.Struct({
    body: Schema.String,
    createdAt: Schema.String,
    displayName: Schema.String,
    id: Schema.String,
    post: Schema.String,
    status: Schema.Literal("approved"),
    websiteUrl: Schema.NullOr(Schema.String),
  }),
  PublicAssetSchema: Schema.Codec<PublicAsset> = Schema.Struct({
    id: Schema.String,
    localPath: Schema.optionalKey(Schema.String),
    metadata: Schema.Struct({
      byteLength: Schema.Number,
      defaultAlternativeText: Schema.optionalKey(Schema.String),
      digest: Schema.String,
      filename: Schema.String,
      height: Schema.optionalKey(Schema.Number),
      mediaType: Schema.String,
      width: Schema.optionalKey(Schema.Number),
    }),
  }),
  PublicBlogExportSchema: Schema.Codec<PublicBlogExport> = Schema.Struct({
    assets: Schema.Array(PublicAssetSchema),
    authors: Schema.Array(PublicAuthorSchema),
    categories: Schema.Array(PublicTaxonomySchema),
    comments: Schema.Array(PublicCommentSchema),
    definitionFingerprint: Schema.String,
    generatedAt: Schema.String,
    posts: Schema.Array(PublicPostSchema),
    tags: Schema.Array(PublicTaxonomySchema),
  }),
  DiscoverySchema = Schema.Struct({
    apiContractVersion: Schema.Literal(1),
    definitionFingerprint: Schema.String,
    richText: Schema.Struct({
      extensions: Schema.Array(Schema.String),
      format: Schema.String,
      version: Schema.Literal(1),
    }),
  }),
  decodeResponse = <Value>(schema: Schema.Codec<Value>, value: unknown, status = 200) =>
    Schema.decodeUnknownEffect(schema)(value).pipe(
      Effect.mapError((issue) => ProtocolFailure.make({ message: String(issue), status })),
    );

export const makeHeadlessClient = (baseAddress: string) => {
  const generatedClient = makeGeneratedClient(baseAddress);
  return {
    discover: (): Effect.Effect<
      Schema.Schema.Type<typeof DiscoverySchema>,
      TransportFailure | ProtocolFailure | DeclaredFailure
    > =>
      generatedClient
        .discoverPublicDefinitionSnapshot({})
        .pipe(Effect.flatMap((value) => decodeResponse(DiscoverySchema, value))),
    exportPublicBlog: (
      expectedFingerprint: string,
    ): Effect.Effect<PublicBlogExport, TransportFailure | ProtocolFailure | DeclaredFailure> =>
      generatedClient
        .exportPublicBlog({
          headers: { "CMS-Expected-Definition-Fingerprint": expectedFingerprint },
        })
        .pipe(Effect.flatMap((value) => decodeResponse(PublicBlogExportSchema, value))),
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
      generatedClient.submitComment({
        body: input,
        headers: { "idempotency-key": idempotencyKey },
        path: { postId },
      }),
  };
};
