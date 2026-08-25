import { Cms, type Operation } from "../../src/index.ts";
/* oxlint-disable eslint/sort-vars -- test constants follow scenario narrative order. */
import { Effect, Exit } from "effect";
import { describe, expect, test } from "bun:test";
import { runAuthorizationExpansion } from "./authorization-expansion-support.ts";

const createVerifyDeniedExpansion = (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- action log must remain mutable for assertions.
    actions: Operation.Action[],
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- deniedAction.current is mutated to simulate authorization denial.
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
      expect(Exit.isFailure(denied)).toBe(true);
      expect(actions.length).toBe(expectedDeniedExpansionActionCount);
      expect(actions[0]).toBe("entry.read");
      expect(actions[1]).toBe("entry.expand");
      return { adaEntry, cms, graceEntry };
    }),
  createVerifyExpandedPerson = (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- action log must remain mutable for assertions.
    actions: Operation.Action[],
  ) =>
    Effect.gen(function* verifyExpandedPerson() {
      const { adaEntry, cms, graceEntry } = yield* seedArticleEntries.pipe(
          Effect.tap(() =>
            Effect.sync(() => {
              actions.length = emptyCollectionLength;
            }),
          ),
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
      expect(actions).toEqual(["entry.read", "entry.expand"] as Operation.Action[]);
      return { adaEntry, cms, graceEntry };
    }),
  createVerifyListRelationshipExpansion = (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- action log must remain mutable for assertions.
    actions: Operation.Action[],
  ) =>
    Effect.gen(function* verifyListRelationshipExpansion() {
      const { adaEntry, cms, graceEntry } = yield* createVerifyExpandedPerson(actions).pipe(
          Effect.tap(() =>
            Effect.sync(() => {
              actions.length = emptyCollectionLength;
            }),
          ),
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
  createVerifyNestedRelationshipExpansion = (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- action log must remain mutable for assertions.
    actions: Operation.Action[],
  ) =>
    Effect.gen(function* verifyNestedRelationshipExpansion() {
      const { adaEntry, cms, graceEntry } = yield* createVerifyListRelationshipExpansion(
          actions,
        ).pipe(
          Effect.tap(() =>
            Effect.sync(() => {
              actions.length = emptyCollectionLength;
            }),
          ),
        ),
        expandedNestedRelationship = yield* cms.queryEntries({
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
      return { adaEntry, cms, graceEntry };
    }),
  emptyCollectionLength = 0,
  expectedDeniedExpansionActionCount = 2,
  entryFromCreateResult = <Entry extends { id: string }>(
    result: Readonly<{ entry: Entry } | Entry>,
  ): Entry => {
    if ("entry" in result) {
      return result.entry;
    }
    return result;
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
