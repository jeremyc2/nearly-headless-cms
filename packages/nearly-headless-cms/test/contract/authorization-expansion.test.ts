import { describe, expect, test } from "bun:test";
import { Effect, Exit, Layer } from "effect";
import type { Management as AssetManagement } from "../../src/asset.ts";
import { Service as AuthorizationService } from "../../src/authorization.ts";
import { Service as CmsService, layer as cmsLayer } from "../../src/cms.ts";
import { ContentDefinition } from "../../src/index.ts";
import type { Generator } from "../../src/identifier.ts";
import { CurrentIdentity, anonymous } from "../../src/identity.ts";
import type { Action } from "../../src/operation.ts";
import type { DefinitionCatalog, EntryPersistence } from "../../src/persistence.ts";
import { layer as identifierLayer } from "../../src/adapters/crypto-identifier-generator.ts";
import { layer as memoryAssetLayer } from "../../src/adapters/memory-asset-management.ts";
import { layer as memoryCatalogLayer } from "../../src/adapters/memory-definition-catalog.ts";
import { layer as memoryEntryLayer } from "../../src/adapters/memory-entry-persistence.ts";

const emptyCollectionLength = 0,
  snapshot = ContentDefinition.compile({
    definitionSpaceId: "authorization-contract",
    definitions: [
      {
        fields: [
          { key: "name", kind: { kind: "text" }, label: "Name", required: true },
          {
            key: "friend",
            kind: { kind: "relationship", targetContentTypeIds: ["person"] },
            label: "Friend",
            nullable: true,
          },
        ],
        id: "person",
        kind: "contentType",
        name: "Person",
      },
      {
        fields: [
          {
            key: "editor",
            kind: { kind: "relationship", targetContentTypeIds: ["person"] },
            label: "Editor",
          },
        ],
        id: "byline",
        kind: "fieldGroup",
        name: "Byline",
      },
      {
        fieldGroups: [
          { fieldGroupId: "byline", key: "metadata", label: "Metadata", mode: "nested" },
        ],
        fields: [
          { key: "title", kind: { kind: "text" }, label: "Title", required: true },
          {
            key: "authors",
            kind: {
              distinct: true,
              element: { kind: "relationship", targetContentTypeIds: ["person"] },
              kind: "list",
            },
            label: "Authors",
          },
        ],
        id: "article",
        kind: "contentType",
        name: "Article",
      },
    ],
    snapshotId: "initial",
  }),
  makeLayer = (actions: Action[], deniedAction: { current?: Action }) => {
    const assetsLayer = memoryAssetLayer().pipe(Layer.provide(identifierLayer)),
      authorizationLayer = Layer.succeed(
        AuthorizationService,
        AuthorizationService.of({
          authorize: (_identity, action) =>
            Effect.sync(() => {
              actions.push(action);
              return action !== deniedAction.current;
            }),
        }),
      ),
      identityLayer = Layer.succeed(
        CurrentIdentity,
        CurrentIdentity.of({ current: Effect.succeed(anonymous) }),
      ),
      catalogLayer = memoryCatalogLayer({ snapshot }).pipe(Layer.provide(memoryEntryLayer)),
      dependencies: Layer.Layer<
        | AuthorizationService
        | CurrentIdentity
        | DefinitionCatalog
        | EntryPersistence
        | AssetManagement
        | Generator
      > = Layer.mergeAll(
        assetsLayer,
        authorizationLayer,
        catalogLayer,
        identifierLayer,
        memoryEntryLayer,
        identityLayer,
      );
    return cmsLayer.pipe(Layer.provide(dependencies));
  };

describe("Authorization and Relationship Expansion contract", () => {
  test("materializes bounded scalar and list paths with exactly one expansion authorization", async () => {
    const actions: Action[] = [],
      deniedAction: { current?: Action } = {};
    await Effect.runPromise(
      Effect.gen(function* () {
        const cms = yield* CmsService,
          ada = yield* cms.createEntry({
            contentTypeId: "person",
            values: { friend: null, name: "Ada" },
          }),
          adaEntry = (() => {
            if ("entry" in ada) {
              return ada.entry;
            }
            return ada;
          })(),
          grace = yield* cms.createEntry({
            contentTypeId: "person",
            values: { friend: adaEntry.id, name: "Grace" },
          }),
          graceEntry = (() => {
            if ("entry" in grace) {
              return grace.entry;
            }
            return grace;
          })();
        yield* cms.createEntry({
          contentTypeId: "article",
          values: {
            authors: [adaEntry.id, graceEntry.id],
            metadata: { editor: graceEntry.id },
            title: "Compilers",
          },
        });

        actions.length = emptyCollectionLength;
        const expandedPerson = yield* cms.getEntry({
          contentTypeId: "person",
          entryId: graceEntry.id,
          expansion: ["friend"],
        });
        expect(expandedPerson.values["friend"]).toEqual({
          contentTypeId: "person",
          id: adaEntry.id,
          values: { friend: null, name: "Ada" },
        });
        expect(actions).toEqual(["entry.read", "entry.expand"]);

        actions.length = emptyCollectionLength;
        const expandedArticle = yield* cms.queryEntries({
          contentTypeId: "article",
          expansion: ["authors.friend"],
          pageSize: 10,
        });
        expect(expandedArticle.items[emptyCollectionLength]?.values["authors"]).toEqual([
          { contentTypeId: "person", id: adaEntry.id, values: { friend: null, name: "Ada" } },
          {
            contentTypeId: "person",
            id: graceEntry.id,
            values: {
              friend: {
                contentTypeId: "person",
                id: adaEntry.id,
                values: { friend: null, name: "Ada" },
              },
              name: "Grace",
            },
          },
        ]);
        expect(actions).toEqual(["entry.query", "entry.expand"]);

        actions.length = emptyCollectionLength;
        const expandedNestedRelationship = yield* cms.queryEntries({
          contentTypeId: "article",
          expansion: ["metadata.editor.friend"],
          pageSize: 10,
        });
        expect(expandedNestedRelationship.items[emptyCollectionLength]?.values["metadata"]).toEqual({
          editor: {
            contentTypeId: "person",
            id: graceEntry.id,
            values: {
              friend: {
                contentTypeId: "person",
                id: adaEntry.id,
                values: { friend: null, name: "Ada" },
              },
              name: "Grace",
            },
          },
        });
        expect(actions).toEqual(["entry.query", "entry.expand"]);

        deniedAction.current = "entry.expand";
        actions.length = emptyCollectionLength;
        const denied = yield* Effect.exit(
          cms.getEntry({
            contentTypeId: "person",
            entryId: "does-not-exist",
            expansion: ["friend"],
          }),
        );
        expect(Exit.isFailure(denied)).toBeTrue();
        expect(actions).toEqual(["entry.read", "entry.expand"]);
      }).pipe(Effect.provide(makeLayer(actions, deniedAction))),
    );
  });
});
