import type { Layer } from "effect";
import type { Entry, EntryHistory, Operation } from "nearly-headless-cms";
import {
  Asset,
  Authorization,
  Cms,
  CmsError,
  ContentDefinition,
  DefinitionMigration,
  EntryQuery,
  Identifier,
  Identity,
  Persistence,
  RichText,
  Transport,
} from "nearly-headless-cms";
import {
  AllowAllAuthorization,
  AnonymousIdentity,
  CryptoIdentifierGenerator,
  MemoryAssetManagement,
  MemoryDefinitionCatalog,
  MemoryEntryPersistence,
} from "nearly-headless-cms/adapters";
import { BunFilesystemPersistence } from "nearly-headless-cms/bun/filesystem";
import { HttpContract, HttpTransport, OpenApi } from "nearly-headless-cms/http";
import { DevelopmentCms } from "nearly-headless-cms/testing";
import packageManifest from "nearly-headless-cms/package.json" with { type: "json" };

void Asset;
void Authorization;
void Cms;
void CmsError;
void ContentDefinition;
void DefinitionMigration;
void EntryQuery;
void Identifier;
void Identity;
void Persistence;
void RichText;
void Transport;
void AllowAllAuthorization;
void AnonymousIdentity;
void CryptoIdentifierGenerator;
void MemoryAssetManagement;
void MemoryDefinitionCatalog;
void MemoryEntryPersistence;
void BunFilesystemPersistence;
void HttpContract;
void HttpTransport;
void OpenApi;
void DevelopmentCms;
void packageManifest;

type PublicEntry = Entry.Representation;
type PublicRevision = EntryHistory.Revision;
type PublicAction = Operation.Action;
const publicTypeFixture: readonly [PublicEntry?, PublicRevision?, PublicAction?] = [];
void publicTypeFixture;

const serviceLayer: Layer.Layer<Cms.Service> = DevelopmentCms.layer({
  snapshot: ContentDefinition.compile({
    definitionSpaceId: "type-fixture",
    definitions: [
      {
        id: "note",
        name: "Note",
        kind: "contentType",
        fields: [{ key: "title", label: "Title", kind: { kind: "text" }, required: true }],
      },
    ],
    snapshotId: "first",
  }),
});
void serviceLayer;

// @ts-expect-error Arbitrary private subpaths are not public package exports.
import { Service as DeepService } from "nearly-headless-cms/private";
void DeepService;
