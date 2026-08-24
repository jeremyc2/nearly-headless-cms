import { Cms, ContentDefinition, type Identifier, type Operation } from "../../src/index.ts";
import {
  CryptoIdentifierGenerator,
  MemoryAssetManagement,
  MemoryDefinitionCatalog,
  MemoryEntryPersistence,
} from "../../src/adapters/index.ts";
import { CurrentIdentity, anonymous } from "../../src/identity.ts";
import type { DefinitionCatalog, EntryPersistence } from "../../src/persistence.ts";
import { Effect, Exit, Layer } from "effect";
import { describe, expect, test } from "bun:test";
import type { Management as AssetManagement } from "../../src/asset.ts";
import { Service as AuthorizationService } from "../../src/authorization.ts";

const authorizationContractSnapshot = ContentDefinition.compile({
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
  createVerifyDeniedExpansion = (
    actions: Operation.Action[],
    deniedAction: { current?: Operation.Action },
  ) =>
    Effect.gen(function* verifyDeniedExpansion() {
      const { adaEntry, cms, graceEntry } = yield* createVerifyNestedRelationshipExpansion(
          actions,
        ).pipe(
          Effect.tap(() =>
            Effect.sync(() => {
              deniedAction.current = "entry.expand";
              actions.length = emptyCollectionLength;
            }),
          ),
        ),
        denied = yield* Effect.exit(
          cms.getEntry({
            contentTypeId: "person",
            entryId: "does-not-exist",
            expansion: ["friend"],
          }),
        );
      expect(Exit.isFailure(denied)).toBeTrue();
      expect(actions).toEqual(["entry.read", "entry.expand"]);
      return { adaEntry, cms, graceEntry };
    }),
  createVerifyExpandedPerson = (actions: Operation.Action[]) =>
    Effect.gen(function* verifyExpandedPerson() {
      const { adaEntry, cms, graceEntry } = yield* seedArticleEntries.pipe(
          Effect.tap(() => Effect.sync(() => {
            actions.length = emptyCollectionLength;
          })),
        ),
        expandedPerson = yield* cms.getEntry({
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
      return { adaEntry, cms, graceEntry };
    }),
  createVerifyListRelationshipExpansion = (actions: Operation.Action[]) =>
    Effect.gen(function* verifyListRelationshipExpansion() {
      const { adaEntry, cms, graceEntry } = yield* createVerifyExpandedPerson(actions).pipe(
          Effect.tap(() => Effect.sync(() => {
            actions.length = emptyCollectionLength;
          })),
        ),
        expandedArticle = yield* cms.queryEntries({
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
      return { adaEntry, cms, graceEntry };
    }),
  createVerifyNestedRelationshipExpansion = (actions: Operation.Action[]) =>
    Effect.gen(function* verifyNestedRelationshipExpansion() {
      const { adaEntry, cms, graceEntry } = yield* createVerifyListRelationshipExpansion(
          actions,
        ).pipe(
          Effect.tap(() => Effect.sync(() => {
            actions.length = emptyCollectionLength;
          })),
        ),
        expandedNestedRelationship = yield* cms.queryEntries({
          contentTypeId: "article",
          expansion: ["metadata.editor.friend"],
          pageSize: 10,
        });
      expect(expandedNestedRelationship.items[emptyCollectionLength]?.values["metadata"]).toEqual(
        {
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
        },
      );
      expect(actions).toEqual(["entry.query", "entry.expand"]);
      return { adaEntry, cms, graceEntry };
    }),
  emptyCollectionLength = 0,
  entryFromCreateResult = <Entry extends { id: string }>(
    result: { entry: Entry } | Entry,
  ): Entry => {
    if ("entry" in result) {
      return result.entry;
    }
    return result;
  },
  makeLayer = (actions: Operation.Action[], deniedAction: { current?: Operation.Action }) => {
    const anonymousIdentity = CurrentIdentity.of({ current: Effect.succeed(anonymous) }),
      assetsLayer = MemoryAssetManagement.layer().pipe(
        Layer.provide(CryptoIdentifierGenerator.layer),
      ),
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
      catalogLayer = MemoryDefinitionCatalog.layer({ snapshot: authorizationContractSnapshot }).pipe(
        Layer.provide(MemoryEntryPersistence.layer),
      ),
      dependencies: Layer.Layer<
        | AuthorizationService
        | CurrentIdentity
        | DefinitionCatalog
        | EntryPersistence
        | AssetManagement
        | Identifier.Generator
      > = Layer.mergeAll(
        assetsLayer,
        authorizationLayer,
        catalogLayer,
        CryptoIdentifierGenerator.layer,
        MemoryEntryPersistence.layer,
        Layer.succeed(CurrentIdentity, anonymousIdentity),
      );
    return Cms.layer.pipe(Layer.provide(dependencies));
  },
  runAuthorizationExpansion = <Value, Error>(
    effect: Effect.Effect<Value, Error, Cms.Service>,
    actions: Operation.Action[],
    deniedAction: { current?: Operation.Action },
  ): Promise<Value> => {
    const layer = makeLayer(actions, deniedAction),
      // This test helper is the application entry point for each isolated test run.
      // oxlint-disable-next-line effecttsgo/strict-effect-provide -- test entry point needs a fresh isolated layer per run.
      providedEffect = effect.pipe(Effect.provide(layer));
    return Effect.runPromise(providedEffect);
  },
  seedArticleEntries = Effect.gen(function* seedArticleEntries() {
    const ada = yield* Cms.Service.pipe(
        Effect.flatMap((cms) =>
          cms.createEntry({
            contentTypeId: "person",
            values: { friend: null, name: "Ada" },
          }),
        ),
      ),
      adaEntry = entryFromCreateResult(ada),
      grace = yield* Cms.Service.pipe(
        Effect.flatMap((cms) =>
          cms.createEntry({
            contentTypeId: "person",
            values: { friend: adaEntry.id, name: "Grace" },
          }),
        ),
      ),
      graceEntry = entryFromCreateResult(grace);
    yield* Cms.Service.pipe(
      Effect.flatMap((cms) =>
        cms.createEntry({
          contentTypeId: "article",
          values: {
            authors: [adaEntry.id, graceEntry.id],
            metadata: { editor: graceEntry.id },
            title: "Compilers",
          },
        }),
      ),
    );
    return { adaEntry, cms: yield* Cms.Service, graceEntry };
  });

describe("Authorization and Relationship Expansion contract", () => {
  test("materializes bounded scalar and list paths with exactly one expansion authorization", () => {
    const actions: Operation.Action[] = [],
      deniedAction: { current?: Operation.Action } = {};
    return runAuthorizationExpansion(
      createVerifyDeniedExpansion(actions, deniedAction),
      actions,
      deniedAction,
    );
  });
});
