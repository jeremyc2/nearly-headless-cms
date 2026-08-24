import type { AppendMigrationManifestInput, PrepareDefinitionMigrationInput } from "../cms-types.ts";
import { InvalidInput, NotFound } from "../cms-error.ts";
import { type JsonObject, isJsonObject } from "../internal/json.ts";
import type { RouteHandlerContext, RouteHandlerResult } from "./http-transport-types.ts";
import { Effect } from "effect";
import transportOperation from "./http-transport-operation.ts";
import transportResponse from "./http-transport-response.ts";

type MigrationManifest = AppendMigrationManifestInput["manifest"];
type SnapshotInput = PrepareDefinitionMigrationInput["snapshot"];

const { jsonResponse } = transportResponse,
  { matchPath, requiredPathParameter } = transportOperation,
  buildActivationEffect = (
    context: RouteHandlerContext,
    body: JsonObject,
    expectedCatalogVersion: number,
  ) => {
    const targetSnapshot = body["snapshot"],
      { migrationPreparationId } = body;
    if (typeof migrationPreparationId === "string") {
      return context.cms.readDefinitionCatalog.pipe(
        Effect.flatMap((state) => {
          const preparation = state.migrationPreparations.find(
            (candidate) => candidate.id === migrationPreparationId,
          );
          if (preparation === undefined) {
            return Effect.fail(
              NotFound.make({
                message: `Migration Preparation ${migrationPreparationId} was not found`,
              }),
            );
          }
          return context.cms.activateDefinitionSnapshot({
            expectedCatalogVersion,
            migration: {
              manifest: preparation.manifest,
              preparationId: preparation.id,
            },
            snapshot: requireSnapshotInput(
              targetSnapshot,
              "Definition activation requires snapshot and expectedCatalogVersion",
            ),
            source: "management-http",
          });
        }),
      );
    }
    return context.cms.activateDefinitionSnapshot({
      expectedCatalogVersion,
      snapshot: requireSnapshotInput(
        targetSnapshot,
        "Definition activation requires snapshot and expectedCatalogVersion",
      ),
      source: "management-http",
    });
  },
  handleCatalogEventsRoute = (context: RouteHandlerContext): RouteHandlerResult | Promise<RouteHandlerResult> => {
    if (
      context.requestUrl.pathname !== `${context.managementBase}/catalog-events` ||
      context.request.method !== "GET"
    ) {
      return undefined;
    }
    return context.withOutcome(context.cms.readDefinitionCatalog, context.requestId, (state) =>
      migrationJsonResponse(context, 200, { catalogVersion: state.version, items: state.events }),
    );
  },
  handleMigrationManifestDetailRoute = (
    context: RouteHandlerContext,
  ): RouteHandlerResult | Promise<RouteHandlerResult> => {
    const migrationManifestMatch = matchPath(
      `${context.managementBase}/migration-manifests/{migrationManifestId}`,
      context.requestUrl.pathname,
    );
    if (migrationManifestMatch === undefined || context.request.method !== "GET") {
      return undefined;
    }
    return context.withOutcome(
      context.cms.readDefinitionCatalog.pipe(
        Effect.flatMap((state) => {
          const manifest = state.migrationManifests.find(
            (candidate) =>
              candidate.id ===
              requiredPathParameter(migrationManifestMatch, "migrationManifestId"),
          );
          if (manifest === undefined) {
            return Effect.fail(NotFound.make({ message: "Migration Manifest was not found" }));
          }
          return Effect.succeed(manifest);
        }),
      ),
      context.requestId,
      (value) => migrationJsonResponse(context, 200, value),
    );
  },
  handleMigrationPreparationDetailRoute = (
    context: RouteHandlerContext,
  ): RouteHandlerResult | Promise<RouteHandlerResult> => {
    const migrationPreparationMatch = matchPath(
      `${context.managementBase}/migration-preparations/{migrationPreparationId}`,
      context.requestUrl.pathname,
    );
    if (migrationPreparationMatch === undefined || context.request.method !== "GET") {
      return undefined;
    }
    return context.withOutcome(
      context.cms.readDefinitionCatalog.pipe(
        Effect.flatMap((state) => {
          const preparation = state.migrationPreparations.find(
            (candidate) =>
              candidate.id ===
              requiredPathParameter(migrationPreparationMatch, "migrationPreparationId"),
          );
          if (preparation === undefined) {
            return Effect.fail(NotFound.make({ message: "Migration Preparation was not found" }));
          }
          return Effect.succeed(preparation);
        }),
      ),
      context.requestId,
      (value) => migrationJsonResponse(context, 200, value),
    );
  },
  hasMigrationManifestHandler = (value: JsonObject): boolean =>
    hasStringField(value, "handlerIdentifier") && hasSafeIntegerField(value, "handlerVersion"),
  hasMigrationManifestIdentity = (value: JsonObject): boolean =>
    hasStringField(value, "id") &&
    hasStringField(value, "sourceSnapshotId") &&
    hasStringField(value, "targetSnapshotId"),
  hasOptionalBooleanField = (value: JsonObject, key: string): boolean => {
    const field: unknown = Reflect.get(value, key);
    return field === undefined || typeof field === "boolean";
  },
  hasOptionalSafeIntegerField = (value: JsonObject, key: string): boolean => {
    const field: unknown = Reflect.get(value, key);
    return field === undefined || (typeof field === "number" && Number.isSafeInteger(field));
  },
  hasSafeIntegerField = (value: JsonObject, key: string): boolean => {
    const field: unknown = Reflect.get(value, key);
    return typeof field === "number" && Number.isSafeInteger(field);
  },
  hasStringField = (value: JsonObject, key: string): boolean =>
    typeof Reflect.get(value, key) === "string",
  isMigrationManifest = (value: unknown): value is MigrationManifest => {
    if (!isJsonObject(value)) {
      return false;
    }
    if (!hasMigrationManifestIdentity(value)) {
      return false;
    }
    if (!hasMigrationManifestHandler(value)) {
      return false;
    }
    return hasOptionalBooleanField(value, "compatible");
  },
  isSnapshotInput = (value: unknown): value is SnapshotInput => {
    if (!isJsonObject(value)) {
      return false;
    }
    if (!hasStringField(value, "definitionSpaceId")) {
      return false;
    }
    if (!hasStringField(value, "snapshotId")) {
      return false;
    }
    if (!Array.isArray(Reflect.get(value, "definitions"))) {
      return false;
    }
    return hasOptionalSafeIntegerField(value, "compilerFormatVersion");
  },
  migrationJsonResponse = (context: RouteHandlerContext, status: number, value: unknown): Response =>
    jsonResponse({
      fingerprint: context.fingerprint,
      requestId: context.requestId,
      status,
      value,
    }),
  requireMigrationManifest = (value: unknown, message: string): MigrationManifest => {
    if (!isMigrationManifest(value)) {
      throw InvalidInput.make({ message });
    }
    return value;
  },
  requireSafeInteger = (value: unknown, message: string): number => {
    if (typeof value !== "number" || !Number.isSafeInteger(value)) {
      throw InvalidInput.make({ message });
    }
    return value;
  },
  requireSnapshotInput = (value: unknown, message: string): SnapshotInput => {
    if (!isSnapshotInput(value)) {
      throw InvalidInput.make({ message });
    }
    return value;
  };

export default {
  buildActivationEffect,
  handleCatalogEventsRoute,
  handleMigrationManifestDetailRoute,
  handleMigrationPreparationDetailRoute,
  migrationJsonResponse,
  requireMigrationManifest,
  requireSafeInteger,
  requireSnapshotInput,
};
