import * as Function from "effect/Function";
import * as Json from "./internal/json.ts";
import type {
  CompileOptions,
  CompiledContentType,
  CompiledSnapshot,
  Definition,
  JsonObject,
  SnapshotInput,
  ValidateEntryOptions,
} from "./content-definition-types.ts";
import entryValuesValidation from "./content-definition-entry-values-validation.ts";
import fieldResolution from "./content-definition-field-resolution.ts";
import relationshipValidation from "./content-definition-relationship-validation.ts";
import validationSupport from "./content-definition-validation-support.ts";

const {
    createValidationIssue,
    defaultCompilerFormatVersion,
    emptyLength,
    failValidation,
    validateIdentifier,
  } = validationSupport,
  acceptSnapshotDefinitions = (input: Readonly<SnapshotInput>): ReadonlyMap<string, Definition> => {
    const definitions = new Map<string, Definition>(),
      inputIssues = [
        ...validateIdentifier(input.definitionSpaceId, ["definitionSpaceId"]),
        ...validateIdentifier(input.snapshotId, ["snapshotId"]),
      ];
    for (const [definitionIndex, definition] of input.definitions.entries()) {
      inputIssues.push(
        ...validateIdentifier(definition.id, ["definitions", definitionIndex, "id"]),
      );
      if (definitions.has(definition.id)) {
        inputIssues.push(
          createValidationIssue(
            ["definitions", definitionIndex, "id"],
            "duplicateDefinition",
            `Definition ${definition.id} occurs more than once`,
          ),
        );
      }
      definitions.set(definition.id, definition);
    }
    if (inputIssues.length > emptyLength) {
      failValidation("Invalid Definition Snapshot", inputIssues);
    }
    return definitions;
  },
  { resolveFields } = fieldResolution,
  { validateEntryValues } = entryValuesValidation,
  { validateRelationshipTargets } = relationshipValidation,
  assertRelationshipTargets = (contentTypes: Map<string, CompiledContentType>): void => {
    for (const [contentTypeId, compiledContentType] of contentTypes) {
      validateRelationshipTargets(contentTypes, compiledContentType.fields, [
        "definitions",
        contentTypeId,
        "fields",
      ]);
    }
  },
  buildCustomRegistrations = (
    options: CompileOptions,
  ): ReadonlyMap<string, NonNullable<CompileOptions["customFieldKinds"]>[number]> =>
    new Map(
      (options.customFieldKinds ?? []).map((registration) => [
        `${registration.identifier}@${registration.formatVersion}`,
        registration,
      ]),
    ),
  compileContentTypes = (
    definitions: ReadonlyMap<string, Definition>,
    customRegistrations: ReturnType<typeof buildCustomRegistrations>,
  ): Map<string, CompiledContentType> => {
    const contentTypes = new Map<string, CompiledContentType>();
    for (const definition of definitions.values()) {
      if (definition.kind === "contentType") {
        contentTypes.set(definition.id, {
          definition,
          fields: resolveFields({
            customRegistrations,
            definition,
            definitions,
            resolving: [],
          }),
        });
      } else {
        resolveFields({ customRegistrations, definition, definitions, resolving: [] });
      }
    }
    return contentTypes;
  },
  compileDualInputMinimumArity = 2,
  // oxlint-disable-next-line effecttsgo/missing-pipeable-signature -- [EH-118] compileSnapshot is exported for typed internal call sites.
  compileSnapshot = (input: SnapshotInput, options: CompileOptions = {}): CompiledSnapshot => {
    const acceptedDefinitions = acceptSnapshotDefinitions(input),
      compilerFormatVersion = input.compilerFormatVersion ?? defaultCompilerFormatVersion,
      customRegistrations = buildCustomRegistrations(options),
      resolvedContentTypes = compileContentTypes(acceptedDefinitions, customRegistrations),
      validateEntry = (
        contentTypeId: string,
        values: JsonObject,
        validateOptions: ValidateEntryOptions,
      ): JsonObject =>
        validateEntryValues({
          contentTypeId,
          contentTypes: resolvedContentTypes,
          customRegistrations,
          validateOptions,
          values,
        });
    assertRelationshipTargets(resolvedContentTypes);
    return {
      compilerFormatVersion,
      contentTypes: resolvedContentTypes,
      definitionSpaceId: input.definitionSpaceId,
      definitions: acceptedDefinitions,
      fingerprint: Json.fingerprint(input),
      input: structuredClone(input),
      snapshotId: input.snapshotId,
      validateEntry,
    };
  },
  // oxlint-disable-next-line effecttsgo/missing-pipeable-signature -- [EH-121] dual's generic overload is not inferred by the linter for this public helper.
  pipeableCompile = Function.dual((arguments_) => {
    if (arguments_.length >= compileDualInputMinimumArity) {
      return true;
    }
    const [firstArgument] = arguments_;
    return (
      arguments_.length === 1 &&
      typeof firstArgument === "object" &&
      firstArgument !== null &&
      "definitionSpaceId" in firstArgument &&
      "definitions" in firstArgument &&
      "snapshotId" in firstArgument
    );
  }, compileSnapshot);

/** Compiles and fingerprints a complete snapshot or throws `InvalidInput` atomically. */
export { compileSnapshot, pipeableCompile as compile };
