import { describe, expect, test } from "bun:test";
import { Effect, Exit } from "effect";
import { Cms, ContentDefinition, type Operation } from "../../src/index.ts";
import { DevelopmentCms } from "../../src/testing/index.ts";

const initialSnapshot = ContentDefinition.compile({
  definitionSpaceId: "definition-lifecycle",
  definitions: [
    {
      fields: [{ key: "title", kind: { kind: "text" }, label: "Title", required: true }],
      history: true,
      id: "note",
      kind: "contentType",
      name: "Note",
      revision: 1,
    },
  ],
  snapshotId: "initial",
});

describe("runtime Content Definition lifecycle", () => {
  test("activates compatible revisions and atomically migrates incompatible Entries", () =>
    Effect.runPromise(
      Effect.gen(function* activateCompatibleRevisions() {
        const cms = yield* Cms.Service,
          created = yield* cms.createEntry({
            contentTypeId: "note",
            values: { title: "A durable note" },
          }),
          entry = "entry" in created ? created.entry : created,
          optionalSummary = {
            fields: [
              { key: "title", kind: { kind: "text" as const }, label: "Title", required: true },
              { key: "summary", kind: { kind: "text" as const }, label: "Summary" },
            ],
            history: true,
            id: "note",
            kind: "contentType" as const,
            name: "Note",
            parentRevision: 1,
            revision: 2,
          },
          appended = yield* cms.appendDefinitionRevision({
            definition: optionalSummary,
            expectedCatalogVersion: 1,
            source: "integration test",
          });
        expect(appended.version).toBe(2);
        const compatible = yield* cms.activateDefinitionSnapshot({
          expectedCatalogVersion: 2,
          snapshot: {
            definitionSpaceId: "definition-lifecycle",
            definitions: [optionalSummary],
            snapshotId: "optional-summary",
          },
          source: "integration test",
        });
        expect(compatible.migratedEntryCount).toBe(0);
        expect((yield* cms.getEntry({ contentTypeId: "note", entryId: entry.id })).values).toEqual({
          title: "A durable note",
        });

        const requiredSlug = {
            ...optionalSummary,
            fields: [
              ...optionalSummary.fields,
              {
                key: "slug",
                kind: { kind: "text" as const },
                label: "Slug",
                required: true,
                unique: true,
              },
            ],
            parentRevision: 2,
            revision: 3,
          },
          appendedRequired = yield* cms.appendDefinitionRevision({
            definition: requiredSlug,
            expectedCatalogVersion: 3,
            source: "integration test",
          }),
          rejected = yield* Effect.exit(
            cms.activateDefinitionSnapshot({
              expectedCatalogVersion: appendedRequired.version,
              snapshot: {
                definitionSpaceId: "definition-lifecycle",
                definitions: [requiredSlug],
                snapshotId: "required-slug",
              },
              source: "integration test",
            }),
          );
        expect(Exit.isFailure(rejected)).toBeTrue();
        expect((yield* cms.activeDefinitionSnapshot).snapshotId).toBe("optional-summary");

        const manifest = {
            handlerIdentifier: "note-slug",
            handlerVersion: 1,
            id: "add-note-slug",
            sourceSnapshotId: "optional-summary",
            targetSnapshotId: "required-slug",
          },
          manifestCatalog = yield* cms.appendMigrationManifest({
            expectedCatalogVersion: appendedRequired.version,
            manifest,
          }),
          preparation = yield* cms.prepareDefinitionMigration({
            expectedCatalogVersion: manifestCatalog.version,
            manifestId: manifest.id,
            snapshot: {
              definitionSpaceId: "definition-lifecycle",
              definitions: [requiredSlug],
              snapshotId: "required-slug",
            },
          }),
          preparedCatalog = yield* cms.readDefinitionCatalog,
          migrated = yield* cms.activateDefinitionSnapshot({
            expectedCatalogVersion: preparedCatalog.version,
            migration: { manifest, preparationId: preparation.id },
            snapshot: {
              definitionSpaceId: "definition-lifecycle",
              definitions: [requiredSlug],
              snapshotId: "required-slug",
            },
            source: "integration test",
          });
        expect(migrated.migratedEntryCount).toBe(1);
        expect(
          (yield* cms.getEntry({ contentTypeId: "note", entryId: entry.id })).values["slug"],
        ).toBe("a-durable-note");

        const current = yield* cms.getCurrentEntryState({
            contentTypeId: "note",
            entryId: entry.id,
          }),
          restored = yield* cms.restoreEntryRevision({
            contentTypeId: "note",
            entryId: entry.id,
            revisionNumber: 1,
            writeToken: current.writeToken,
          });
        expect(restored.entry.values["slug"]).toBe("a-durable-note");

        const catalog = yield* cms.readDefinitionCatalog;
        expect(catalog.active.compiled.snapshotId).toBe("required-slug");
        expect(catalog.events.map((event) => event.eventType)).toContain("revisionAppended");
        expect(catalog.events.map((event) => event.eventType)).toContain("snapshotActivated");
      }).pipe(
        Effect.provide(
          DevelopmentCms.layer({
            migrationHandlers: [
              {
                identifier: "note-slug",
                transform: ({ values }) => ({ ...values, slug: "a-durable-note" }),
                version: 1,
              },
            ],
            snapshot: initialSnapshot,
          }),
        ),
      ),
    ));

  test("retains composition-time Custom Field registrations during activation", () => {
    const ratingRegistration: ContentDefinition.CustomFieldRegistration = {
      capabilities: { filter: ["equals"], projectable: true, sortable: true },
      formatVersion: 1,
      identifier: "com.example.rating",
      validateConfiguration: () => [],
      validateValue: (value) =>
        typeof value === "number" && Number.isSafeInteger(value) && value >= 1 && value <= 5
          ? []
          : [
              {
                message: "Rating must be an integer from one through five",
                path: [],
                reason: "invalidRating",
              },
            ],
    };
    return Effect.runPromise(
      Effect.gen(function* retainCustomFieldRegistrations() {
        const cms = yield* Cms.Service,
          ratedNote = {
            fields: [
              { key: "title", kind: { kind: "text" as const }, label: "Title", required: true },
              {
                key: "rating",
                kind: {
                  configuration: {},
                  formatVersion: 1,
                  identifier: "com.example.rating",
                  kind: "custom" as const,
                },
                label: "Rating",
              },
            ],
            history: true,
            id: "note",
            kind: "contentType" as const,
            name: "Note",
            parentRevision: 1,
            revision: 2,
          },
          appended = yield* cms.appendDefinitionRevision({
            definition: ratedNote,
            expectedCatalogVersion: 1,
          }),
          activated = yield* cms.activateDefinitionSnapshot({
            expectedCatalogVersion: appended.version,
            snapshot: {
              definitionSpaceId: "definition-lifecycle",
              definitions: [ratedNote],
              snapshotId: "rated-notes",
            },
          });
        expect(activated.snapshot.snapshotId).toBe("rated-notes");
        yield* cms.createEntry({
          contentTypeId: "note",
          values: { rating: 5, title: "Excellent" },
        });
        expect(
          Exit.isFailure(
            yield* Effect.exit(
              cms.createEntry({ contentTypeId: "note", values: { rating: 6, title: "Invalid" } }),
            ),
          ),
        ).toBeTrue();
      }).pipe(
        Effect.provide(
          DevelopmentCms.layer({
            compileOptions: { customFieldKinds: [ratingRegistration] },
            snapshot: initialSnapshot,
          }),
        ),
      ),
    );
  });

  test("rejects activation that breaks a composed operation contract", async () => {
    const operationContracts: readonly Operation.DefinitionContract[] = [
      {
        definitionRequirements: [
          {
            contentTypeId: "note",
            fields: [{ kind: "text", path: "title", projectable: true, required: true }],
          },
        ],
        identifier: "readPublicNote",
      },
    ];
    await Effect.runPromise(
      Effect.gen(function* contractActivation() {
        const cms = yield* Cms.Service,
          incompatibleNote = {
            fields: [
              { key: "title", kind: { kind: "integer" as const }, label: "Title", required: true },
            ],
            history: true,
            id: "note",
            kind: "contentType" as const,
            name: "Note",
            parentRevision: 1,
            revision: 2,
          },
          appended = yield* cms.appendDefinitionRevision({
            definition: incompatibleNote,
            expectedCatalogVersion: 1,
          }),
          activation = yield* Effect.exit(
            cms.activateDefinitionSnapshot({
              expectedCatalogVersion: appended.version,
              snapshot: {
                definitionSpaceId: "definition-lifecycle",
                definitions: [incompatibleNote],
                snapshotId: "incompatible-operation-contract",
              },
            }),
          );
        expect(Exit.isFailure(activation)).toBeTrue();
        expect((yield* cms.activeDefinitionSnapshot).snapshotId).toBe("initial");
        expect((yield* cms.readDefinitionCatalog).version).toBe(appended.version);
      }).pipe(
        Effect.provide(DevelopmentCms.layer({ operationContracts, snapshot: initialSnapshot })),
      ),
    );
  });
});
