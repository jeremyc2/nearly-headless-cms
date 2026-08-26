import {
  type DeclaredFailure,
  ProtocolFailure,
  type TransportFailure,
  makeGeneratedClient,
} from "./headless-openapi-client.ts";
import { Effect, Schema } from "effect";

export { DeclaredFailure, ProtocolFailure, TransportFailure } from "./headless-openapi-client.ts";

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
  readonly version: typeof richTextFormatVersion;
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

export interface PublicGuide {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly description: string;
  readonly body: RichTextDocument;
  readonly sortOrder: number;
  readonly nextGuide: string | null;
  readonly status: "published";
}

export interface PublicBlogExport {
  readonly definitionFingerprint: string;
  readonly generatedAt: string;
  readonly posts: readonly PublicPost[];
  readonly authors: readonly PublicAuthor[];
  readonly categories: readonly PublicTaxonomy[];
  readonly tags: readonly PublicTaxonomy[];
  readonly comments: readonly PublicComment[];
  readonly guides: readonly PublicGuide[];
  readonly assets: readonly PublicAsset[];
}

export interface SubmitCommentInput {
  readonly body: string;
  readonly displayName: string;
  readonly websiteUrl: string | null;
}

export interface HeadlessClient {
  readonly discover: Effect.Effect<
    typeof schemaDiscovery.Type,
    TransportFailure | ProtocolFailure | DeclaredFailure
  >;
  readonly exportPublicBlog: (
    expectedFingerprint: string,
  ) => Effect.Effect<PublicBlogExport, TransportFailure | ProtocolFailure | DeclaredFailure>;
  readonly submitComment: (
    postId: string,
    input: SubmitCommentInput,
    idempotencyKey: string,
  ) => Effect.Effect<
    { readonly submissionId: string; readonly status: "pending" },
    TransportFailure | ProtocolFailure | DeclaredFailure
  >;
}

const apiContractVersion = 1,
  apiSuccessfulResponseStatus = 200,
  decodeResponse = <
    Value,
    Input extends {
      readonly schema: Schema.Codec<Value>;
      readonly status?: number;
      readonly value: unknown;
    },
  >(
    input: Readonly<Input>,
  ): Effect.Effect<Value, ProtocolFailure> => {
    const status = input.status ?? apiSuccessfulResponseStatus;
    return Schema.decodeUnknownEffect(input.schema)(input.value).pipe(
      Effect.mapError((issue) => ProtocolFailure.make({ message: String(issue), status })),
    );
  },
  generatorFormatVersion = 1,
  makeBaseTaggedErrorClass = Schema.TaggedError,
  makeRichTextNodeSchema = (): Schema.Codec<RichTextNode> => {
    const richTextNodeSchema: Schema.Codec<RichTextNode> = Schema.suspend(
      (): Schema.Codec<RichTextNode> => {
        const childSchema = Schema.Array(richTextNodeSchema);
        return Schema.Struct({
          alternativeText: Schema.optionalKey(Schema.String),
          assetId: Schema.optionalKey(Schema.String),
          caption: Schema.optionalKey(Schema.String),
          children: Schema.optionalKey(childSchema),
          entryId: Schema.optionalKey(Schema.String),
          level: Schema.optionalKey(Schema.Finite),
          marks: Schema.optionalKey(Schema.Array(Schema.String)),
          text: Schema.optionalKey(Schema.String),
          type: Schema.String,
          url: Schema.optionalKey(Schema.String),
        });
      },
    );
    return richTextNodeSchema;
  },
  richTextFormatVersion = 1,
  schemaCommonRichTextNode = makeRichTextNodeSchema(),
  schemaCommonRichTextNodeDocument: Schema.Codec<RichTextDocument> = Schema.Struct({
    children: Schema.Array(schemaCommonRichTextNode),
    format: Schema.Literal("nearly-headless-cms/rich-text"),
    version: Schema.Literal(richTextFormatVersion),
  }),
  schemaDiscovery = Schema.Struct({
    apiContractVersion: Schema.Literal(apiContractVersion),
    definitionFingerprint: Schema.String,
    richText: Schema.Struct({
      extensions: Schema.Array(Schema.String),
      format: Schema.String,
      version: Schema.Literal(richTextFormatVersion),
    }),
  }),
  schemaPublicBlogAsset: Schema.Codec<PublicAsset> = Schema.Struct({
    id: Schema.String,
    localPath: Schema.optionalKey(Schema.String),
    metadata: Schema.Struct({
      byteLength: Schema.Finite,
      defaultAlternativeText: Schema.optionalKey(Schema.String),
      digest: Schema.String,
      filename: Schema.String,
      height: Schema.optionalKey(Schema.Finite),
      mediaType: Schema.String,
      width: Schema.optionalKey(Schema.Finite),
    }),
  }),
  schemaPublicBlogAuthor: Schema.Codec<PublicAuthor> = Schema.Struct({
    biography: Schema.String,
    externalLinks: Schema.Array(Schema.JsonObject),
    id: Schema.String,
    name: Schema.String,
    portrait: Schema.NullOr(Schema.String),
    portraitAlternativeText: Schema.NullOr(Schema.String),
    profile: Schema.NullOr(schemaCommonRichTextNodeDocument),
    slug: Schema.String,
  }),
  schemaPublicBlogComment: Schema.Codec<PublicComment> = Schema.Struct({
    body: Schema.String,
    createdAt: Schema.String,
    displayName: Schema.String,
    id: Schema.String,
    post: Schema.String,
    status: Schema.Literal("approved"),
    websiteUrl: Schema.NullOr(Schema.String),
  }),
  schemaPublicBlogPost: Schema.Codec<PublicPost> = Schema.Struct({
    author: Schema.String,
    body: schemaCommonRichTextNodeDocument,
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
  schemaPublicBlogGuide: Schema.Codec<PublicGuide> = Schema.Struct({
    body: schemaCommonRichTextNodeDocument,
    description: Schema.String,
    id: Schema.String,
    nextGuide: Schema.NullOr(Schema.String),
    slug: Schema.String,
    sortOrder: Schema.Int,
    status: Schema.Literal("published"),
    title: Schema.String,
  }),
  schemaPublicBlogTaxonomy: Schema.Codec<PublicTaxonomy> = Schema.Struct({
    description: Schema.NullOr(Schema.String),
    id: Schema.String,
    name: Schema.String,
    slug: Schema.String,
  }),
  schemaPublicBlogZExport: Schema.Codec<PublicBlogExport> = Schema.Struct({
    assets: Schema.Array(schemaPublicBlogAsset),
    authors: Schema.Array(schemaPublicBlogAuthor),
    categories: Schema.Array(schemaPublicBlogTaxonomy),
    comments: Schema.Array(schemaPublicBlogComment),
    definitionFingerprint: Schema.String,
    generatedAt: Schema.String,
    guides: Schema.Array(schemaPublicBlogGuide),
    posts: Schema.Array(schemaPublicBlogPost),
    tags: Schema.Array(schemaPublicBlogTaxonomy),
  }),
  zMakeHeadlessClient = (baseAddress: string): HeadlessClient => {
    const generatedClient = makeGeneratedClient(baseAddress);
    return {
      discover: generatedClient
        .discoverPublicDefinitionSnapshot({})
        .pipe(Effect.flatMap((value) => decodeResponse({ schema: schemaDiscovery, value }))),
      exportPublicBlog: (expectedFingerprint) =>
        generatedClient
          .exportPublicBlog({
            headers: { "CMS-Expected-Definition-Fingerprint": expectedFingerprint },
          })
          .pipe(
            Effect.flatMap((value) => decodeResponse({ schema: schemaPublicBlogZExport, value })),
          ),
      submitComment: (postId, input, idempotencyKey) =>
        generatedClient.submitComment({
          body: input,
          headers: { "idempotency-key": idempotencyKey },
          path: { postId },
        }),
    };
  };

export class UnsupportedDefinition extends makeBaseTaggedErrorClass<UnsupportedDefinition>()(
  "UnsupportedDefinition",
  { message: Schema.String },
) {}

export {
  generatorFormatVersion,
  schemaPublicBlogZExport as PublicBlogExportSchema,
  zMakeHeadlessClient as makeHeadlessClient,
};
