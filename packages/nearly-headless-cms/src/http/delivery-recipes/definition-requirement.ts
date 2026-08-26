import { capabilitiesFor } from "../../content-definition-capabilities.ts";
import type { CompiledSnapshot, ResolvedField } from "../../content-definition-types.ts";
import type { DefinitionRequirement, FieldContract } from "../../operation.ts";

/** Options for deriving a Definition Requirement from a compiled Content Type. */
export interface DefinitionRequirementOptions {
  readonly fieldPaths?: readonly string[];
  readonly projectableOnly?: boolean;
}

const defaultFormatVersion = 1,
  fieldKindIdentifier = (field: Readonly<ResolvedField>): string => {
    if (field.kind.kind === "custom") {
      return field.kind.identifier;
    }
    return field.kind.kind;
  },
  fieldContractFromResolvedField = (field: Readonly<ResolvedField>): FieldContract => ({
    kind: fieldKindIdentifier(field),
    path: field.key,
    ...(capabilitiesFor(field.kind).projectable === true ? { projectable: true as const } : {}),
    ...(field.required === true ? { required: true as const } : {}),
    ...(field.kind.kind === "rich-text"
      ? { formatVersion: field.kind.formatVersion ?? defaultFormatVersion }
      : {}),
  }),
  findTopLevelField = (
    fields: readonly ResolvedField[],
    path: string,
  ): ResolvedField | undefined => fields.find((candidate) => candidate.key === path),
  resolveFieldContracts = (
    contentTypeFields: readonly ResolvedField[],
    options: Readonly<DefinitionRequirementOptions>,
  ): readonly FieldContract[] => {
    let selectedFields = contentTypeFields;
    if (options.fieldPaths !== undefined) {
      selectedFields = options.fieldPaths.flatMap((fieldPath) => {
        const field = findTopLevelField(contentTypeFields, fieldPath);
        if (field === undefined) {
          return [];
        }
        return [field];
      });
    }
    return selectedFields
      .filter(
        (field) =>
          options.projectableOnly !== true || capabilitiesFor(field.kind).projectable === true,
      )
      .map(fieldContractFromResolvedField);
  },
  // oxlint-disable-next-line effecttsgo/missing-pipeable-signature -- [EH-298] Definition Requirement derivation is intentionally a direct Snapshot lookup helper.
  definitionRequirementFromContentType = (
    snapshot: CompiledSnapshot,
    contentTypeId: string,
    options: DefinitionRequirementOptions = {},
  ): DefinitionRequirement => {
    const contentType = snapshot.contentTypes.get(contentTypeId);
    if (contentType === undefined) {
      throw new Error(`Content Type ${contentTypeId} is missing from the compiled Snapshot`);
    }
    return {
      contentTypeId,
      fields: resolveFieldContracts(contentType.fields, options),
    };
  },
  // oxlint-disable-next-line effecttsgo/missing-pipeable-signature -- [EH-299] batch Definition Requirement derivation is intentionally a direct Snapshot lookup helper.
  definitionRequirementsFromContentTypes = (
    snapshot: CompiledSnapshot,
    contentTypeIds: readonly string[],
    options: DefinitionRequirementOptions = {},
  ): readonly DefinitionRequirement[] =>
    contentTypeIds.map((contentTypeId) =>
      definitionRequirementFromContentType(snapshot, contentTypeId, options),
    );

/** Derives a Definition Requirement from one Content Type in a compiled Snapshot. */
export { definitionRequirementFromContentType };

/** Derives Definition Requirements for several Content Types in one call. */
export { definitionRequirementsFromContentTypes };
