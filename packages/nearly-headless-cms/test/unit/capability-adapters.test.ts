import { expect, test } from "bun:test";
import { Effect, Stream, SynchronizedRef } from "effect";
import { compileSnapshot } from "../../src/content-definition.ts";
import {
  AssetManagementCapabilities,
  ClaimsIdentity,
  EntryPersistenceCapabilities,
  RoleBasedAuthorization,
} from "../../src/adapters/index.ts";
import { Management as AssetManagement } from "../../src/asset.ts";
import {
  type EntryGeneration,
  EntryPersistence,
  type EntryRecord,
} from "../../src/persistence.ts";

const snapshot = compileSnapshot({
    definitionSpaceId: "capability-tests",
    definitions: [
      {
        fields: [{ key: "title", kind: { kind: "text" }, label: "Title", required: true }],
        id: "note",
        kind: "contentType",
        name: "Note",
      },
    ],
    snapshotId: "initial",
  }),
  runEntryCapabilities = Effect.gen(function* verifyEntryCapabilities() {
    const state = yield* SynchronizedRef.make<EntryGeneration>({
        generation: 0,
        records: new Map<string, EntryRecord>(),
      }),
      persistence = EntryPersistence.of({
        commitGeneration: (expectedGeneration, records) =>
          SynchronizedRef.modifyEffect(state, (current) => {
            expect(current.generation).toBe(expectedGeneration);
            const next = { generation: current.generation + 1, records: new Map(records) };
            return Effect.succeed([next, next] as const);
          }),
        readGeneration: (_void: void) => SynchronizedRef.get(state),
      }),
      reader = EntryPersistenceCapabilities.readerFromPersistence(persistence),
      writer = EntryPersistenceCapabilities.writerFromPersistence(persistence),
      record: EntryRecord = {
        entry: { contentTypeId: "note", id: "note-1", values: { title: "Queryable" } },
        revisions: [],
      };
    expect(
      yield* writer.commit({
        changes: [{ entryId: "note-1", kind: "put", record }],
        expectedGeneration: 0,
      }),
    ).toBe(1);
    expect((yield* reader.get("note-1")).record).toEqual(record);
    expect(
      (yield* reader.query({ query: { contentTypeId: "note", pageSize: 10 }, snapshot })).page
        .items,
    ).toEqual([record.entry]);
  }),
  roleAuthorization = RoleBasedAuthorization.make({
    policy: ({ action, roles }) => action === "entry.read" && roles.includes("editor"),
    rolesOf: (identity) => {
      if (identity.state === "actor" && identity.actor === "editor") {
        return ["editor"];
      }
      return [];
    },
  }),
  testAsset = {
    id: "asset-1",
    metadata: {
      byteLength: 5,
      digest: "digest",
      filename: "note.txt",
      mediaType: "text/plain",
    },
  },
  assetManagement = AssetManagement.of({
    delete: (_assetIdentifier) => Effect.void,
    get: (_assetIdentifier) => Effect.succeed(testAsset),
    ingest: (_input) => Effect.succeed(testAsset),
    list: (_void: void) => Effect.succeed([testAsset]),
    read: (_assetIdentifier) =>
      Effect.succeed({ ...testAsset, content: Stream.make(new TextEncoder().encode("hello")) }),
  });

test("Entry persistence compatibility exposes queryable reads and atomic row-level writes", () =>
  Effect.runPromise(runEntryCapabilities));

test("RoleBasedAuthorization builds authorization from pure role and policy functions", () =>
  Effect.runPromise(
    Effect.gen(function* verifyRolePolicy() {
      expect(
        yield* roleAuthorization.authorize(
          { actor: "editor", state: "actor" },
          "entry.read",
          { definitionSpaceId: "test", kind: "definitionSpace" },
        ),
      ).toBeTrue();
      expect(
        yield* roleAuthorization.authorize(
          { state: "anonymous" },
          "entry.read",
          { definitionSpaceId: "test", kind: "definitionSpace" },
        ),
      ).toBeFalse();
    }),
  ));

test("ClaimsIdentity resolves valid Bearer tokens and leaves missing headers anonymous", () => {
  const resolveIdentity = ClaimsIdentity.fromBearerVerifier((bearerToken) =>
    Effect.succeed({ subject: bearerToken }),
  );
  return Effect.runPromise(
    Effect.gen(function* verifyClaimsIdentity() {
      expect(yield* resolveIdentity()).toEqual({ state: "anonymous" });
      expect(yield* resolveIdentity("Bearer account-1")).toEqual({
        actor: { subject: "account-1" },
        state: "actor",
      });
    }),
  );
});

test("Asset Management compatibility exposes direct-stream transfer intents", () =>
  Effect.runPromise(
    Effect.gen(function* verifyAssetCapabilities() {
      const transfer = AssetManagementCapabilities.transferFromManagement(assetManagement),
        catalog = AssetManagementCapabilities.catalogFromManagement(assetManagement),
        upload = yield* transfer.prepareUpload({
          filename: "note.txt",
          mediaType: "text/plain",
        });
      expect(upload.kind).toBe("direct-stream");
      if (upload.kind !== "direct-stream") {
        return yield* Effect.die("Expected direct-stream upload intent");
      }
      {
        const asset = yield* upload.ingest({ content: new TextEncoder().encode("hello") });
        expect(yield* catalog.get(asset.id)).toEqual(asset);
        expect((yield* transfer.prepareDownload(asset.id)).kind).toBe("direct-stream");
        return yield* Effect.void;
      }
    }),
  ));
