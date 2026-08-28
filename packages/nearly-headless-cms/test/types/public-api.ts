import {
  AllowAllAuthorization,
  AnonymousIdentity,
  AssetManagementCapabilities,
  ClaimsIdentity,
  CryptoIdentifierGenerator,
  EntryPersistenceCapabilities,
  MemoryAssetManagement,
  MemoryDefinitionCatalog,
  MemoryEntryPersistence,
  RoleBasedAuthorization,
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
// @ts-expect-error [EH-001] Arbitrary private subpaths are not public package exports.
import { Service as DeepService } from "nearly-headless-cms/private";
import { DevelopmentCms } from "nearly-headless-cms/testing";
import type { Layer } from "effect";
import { default as packageManifest } from "nearly-headless-cms/package.json" with { type: "json" };

type PublicEntry = Entry.Representation;
type PublicRevision = EntryHistory.Revision;
type PublicAction = Operation.Action;

export const asUnknown = (value: unknown): unknown => value,
  deepService = asUnknown(DeepService),
  publicApiValues = [
    AllowAllAuthorization,
    AnonymousIdentity,
    Asset,
    AssetManagementCapabilities,
    Authorization,
    BunFilesystemPersistence,
    Cms,
    CmsError,
    ContentDefinition,
    ClaimsIdentity,
    CryptoIdentifierGenerator,
    DefinitionMigration,
    DevelopmentCms,
    EntryQuery,
    EntryPersistenceCapabilities,
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
    RoleBasedAuthorization,
    Transport,
  ],
  publicTypeFixture: readonly [PublicEntry?, PublicRevision?, PublicAction?] = [],
  serviceLayer: Layer.Layer<Cms.Service> = DevelopmentCms.layer({
    snapshot: ContentDefinition.compileSnapshot({
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
