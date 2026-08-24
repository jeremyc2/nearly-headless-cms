import {
  AllowAllAuthorization,
  AnonymousIdentity,
  CryptoIdentifierGenerator,
  MemoryAssetManagement,
  MemoryDefinitionCatalog,
  MemoryEntryPersistence,
} from "nearly-headless-cms/adapters";
import {
  Asset,
  Authorization,
  Cms,
  CmsError,
  ContentDefinition,
  DefinitionMigration,
  type Entry,
  type EntryHistory,
  EntryQuery,
  Identifier,
  Identity,
  type Operation,
  Persistence,
  RichText,
  Transport,
} from "nearly-headless-cms";
import { HttpContract, HttpTransport, OpenApi } from "nearly-headless-cms/http";
import { BunFilesystemPersistence } from "nearly-headless-cms/bun/filesystem";
// @ts-expect-error Arbitrary private subpaths are not public package exports.
import { Service as DeepService } from "nearly-headless-cms/private";
import { DevelopmentCms } from "nearly-headless-cms/testing";
import type { Layer } from "effect";
import { default as packageManifest } from "nearly-headless-cms/package.json" with { type: "json" };

export const publicApiValues = [
  AllowAllAuthorization,
  AnonymousIdentity,
  Asset,
  Authorization,
  BunFilesystemPersistence,
  Cms,
  CmsError,
  ContentDefinition,
  CryptoIdentifierGenerator,
  DefinitionMigration,
  DevelopmentCms,
  EntryQuery,
  HttpContract,
  HttpTransport,
  Identifier,
  Identity,
  MemoryAssetManagement,
  MemoryDefinitionCatalog,
  MemoryEntryPersistence,
  OpenApi,
  packageManifest,
  Persistence,
  RichText,
  Transport,
];

type PublicEntry = Entry.Representation;
type PublicRevision = EntryHistory.Revision;
type PublicAction = Operation.Action;
export const publicTypeFixture: readonly [PublicEntry?, PublicRevision?, PublicAction?] = [];

export const serviceLayer: Layer.Layer<Cms.Service> = DevelopmentCms.layer({
  snapshot: ContentDefinition.compile({
    definitionSpaceId: "type-fixture",
    definitions: [
      {
        fields: [{ key: "title", kind: { kind: "text" }, label: "Title", required: true }],
        id: "note",
        kind: "contentType",
        name: "Note",
      },
    ],
    snapshotId: "first",
  }),
});
const asUnknown = (value: unknown): unknown => value;
export const deepService = asUnknown(DeepService);
