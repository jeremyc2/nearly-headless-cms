import type { RouteHandlerContext, RouteHandlerResult } from "./http-transport-types.ts";
import { httpStatusCreated, httpStatusOk } from "./http-status-codes.ts";
import { InvalidInput } from "../cms-error.ts";
import dispatchRouteHandlers from "./http-transport-route-dispatch.ts";
import migrationRouteSupport from "./http-transport-definition-migration-route-support.ts";
import transportResponse from "./http-transport-response.ts";

const { invalidRequestResponse, jsonResponse } = transportResponse,
  {
    buildActivationEffect,
    handleCatalogEventsRoute,
    handleMigrationManifestDetailRoute,
    handleMigrationPreparationDetailRoute,
    migrationJsonResponse,
    requireMigrationManifest,
    requireSafeInteger,
    requireSnapshotInput,
  } = migrationRouteSupport,
  // oxlint-disable-next-line effecttsgo/async-function -- route handlers await JSON body parsing before Effect execution.
  handleDefinitionActivationRoute = async (
    context: Readonly<RouteHandlerContext>,
  ): Promise<RouteHandlerResult> => {
    if (
      context.requestUrl.pathname !== `${context.managementBase}/definition-snapshot-activations` ||
      context.request.method !== "POST"
    ) {
      return undefined;
    }
    try {
      const body = await context.parseJson(context.request, context.maximumJsonBodyByteLength);
      return await context.withOutcome(
        () =>
          buildActivationEffect(
            context,
            body,
            requireSafeInteger(
              body["expectedCatalogVersion"],
              "Definition activation requires snapshot and expectedCatalogVersion",
            ),
          ),
        context.requestId,
        (result) =>
          jsonResponse({
            fingerprint: result.snapshot.fingerprint,
            requestId: context.requestId,
            status: httpStatusCreated,
            value: {
              catalogVersion: result.catalogVersion,
              fingerprint: result.snapshot.fingerprint,
              migratedEntryCount: result.migratedEntryCount,
              snapshotId: result.snapshot.snapshotId,
            },
          }),
      );
    } catch (error) {
      return invalidRequestResponse(
        error,
        "Invalid Definition activation request",
        context.requestId,
      );
    }
  },
  handleDefinitionMigrationRoutes = (
    context: Readonly<RouteHandlerContext>,
  ): Promise<RouteHandlerResult> => dispatchRouteHandlers(migrationRouteHandlers, context),
  // oxlint-disable-next-line effecttsgo/async-function -- route handlers await JSON body parsing before Effect execution.
  handleMigrationManifestAppendRoute = async (
    context: Readonly<RouteHandlerContext>,
  ): Promise<RouteHandlerResult> => {
    if (
      context.requestUrl.pathname !== `${context.managementBase}/migration-manifests` ||
      context.request.method !== "POST"
    ) {
      return undefined;
    }
    try {
      const body = await context.parseJson(context.request, context.maximumJsonBodyByteLength);
      return await context.withOutcome(
        () =>
          context.cms.appendMigrationManifest({
            expectedCatalogVersion: requireSafeInteger(
              body["expectedCatalogVersion"],
              "Migration Manifest append requires manifest and expectedCatalogVersion",
            ),
            manifest: requireMigrationManifest(
              body["manifest"],
              "Migration Manifest append requires manifest and expectedCatalogVersion",
            ),
          }),
        context.requestId,
        (state) =>
          migrationJsonResponse(context, httpStatusCreated, { catalogVersion: state.version }),
      );
    } catch (error) {
      return invalidRequestResponse(
        error,
        "Invalid Migration Manifest append request",
        context.requestId,
      );
    }
  },
  handleMigrationManifestListRoute = (
    context: Readonly<RouteHandlerContext>,
  ): RouteHandlerResult | Promise<RouteHandlerResult> => {
    if (
      context.requestUrl.pathname !== `${context.managementBase}/migration-manifests` ||
      context.request.method !== "GET"
    ) {
      return undefined;
    }
    return context.withOutcome(
      () => context.cms.readDefinitionCatalog(),
      context.requestId,
      (state) =>
        migrationJsonResponse(context, httpStatusOk, {
          catalogVersion: state.version,
          items: state.migrationManifests,
        }),
    );
  },
  // oxlint-disable-next-line effecttsgo/async-function -- route handlers await JSON body parsing before Effect execution.
  handleMigrationPreparationCreateRoute = async (
    context: Readonly<RouteHandlerContext>,
  ): Promise<RouteHandlerResult> => {
    if (
      context.requestUrl.pathname !== `${context.managementBase}/migration-preparations` ||
      context.request.method !== "POST"
    ) {
      return undefined;
    }
    try {
      const body = await context.parseJson(context.request, context.maximumJsonBodyByteLength),
        { manifestId } = body;
      if (typeof manifestId !== "string") {
        throw InvalidInput.make({
          message:
            "Migration Preparation requires manifestId, snapshot, and expectedCatalogVersion",
        });
      }
      return await context.withOutcome(
        () =>
          context.cms.prepareDefinitionMigration({
            expectedCatalogVersion: requireSafeInteger(
              body["expectedCatalogVersion"],
              "Migration Preparation requires manifestId, snapshot, and expectedCatalogVersion",
            ),
            manifestId,
            snapshot: requireSnapshotInput(
              body["snapshot"],
              "Migration Preparation requires manifestId, snapshot, and expectedCatalogVersion",
            ),
          }),
        context.requestId,
        (preparation) => migrationJsonResponse(context, httpStatusOk, preparation),
      );
    } catch (error) {
      return invalidRequestResponse(
        error,
        "Invalid Migration Preparation request",
        context.requestId,
      );
    }
  },
  migrationRouteHandlers = [
    handleDefinitionActivationRoute,
    handleCatalogEventsRoute,
    handleMigrationManifestListRoute,
    handleMigrationManifestAppendRoute,
    handleMigrationManifestDetailRoute,
    handleMigrationPreparationDetailRoute,
    handleMigrationPreparationCreateRoute,
  ];

export default handleDefinitionMigrationRoutes;
