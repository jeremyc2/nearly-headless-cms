import {
  type CompiledSnapshot,
  type ResolvedField,
  capabilitiesFor,
} from "./content-definition.ts";
import { InvalidInput, type ValidationIssue } from "./cms-error.ts";

/** The closed generic CMS operation vocabulary submitted to Authorization. */
export type Action =
  | "definition.read"
  | "definition.write"
  | "definition.activate"
  | "entry.create"
  | "entry.read"
  | "entry.update"
  | "entry.delete"
  | "entry.query"
  | "entry.expand"
  | "entry.history.read"
  | "entry.history.restore"
  | "entry.history.purge"
  | "asset.create"
  | "asset.read"
  | "asset.delete"
  | "public.read";

/** Minimal library-owned Resource descriptors submitted to Authorization. */
export type Resource =
  | { readonly kind: "definitionSpace"; readonly definitionSpaceId: string }
  | {
      readonly kind: "contentType";
      readonly definitionSpaceId: string;
      readonly contentTypeId: string;
    }
  | {
      readonly kind: "entry";
      readonly definitionSpaceId: string;
      readonly contentTypeId: string;
      readonly entryId?: string;
    }
  | { readonly kind: "asset"; readonly definitionSpaceId: string; readonly assetId?: string };

/** Presentation-neutral contract for a Builder-selected public operation. */
export interface DeliveryOperation<Request, Response> {
  readonly handler: (request: Request) => Response;
  readonly identifier: string;
  readonly method: "GET" | "POST" | "PUT" | "DELETE" | "HEAD";
  readonly path: string;
  readonly reachableContentTypeIds: readonly string[];
  readonly requiresIdempotencyKey?: boolean;
}

/** A Field path and capabilities required by an operation contract. */
export interface FieldContract {
  readonly formatVersion?: number;
  /** Built-in Field Kind or registered Custom Field Kind identifier. */
  readonly kind: string;
  readonly path: string;
  readonly projectable?: boolean;
  readonly required?: boolean;
  readonly richTextExtensionIdentifiers?: readonly string[];
}

/** Content Type requirements preserved across Definition activation. */
export interface DefinitionRequirement {
  readonly contentTypeId: string;
  readonly fields: readonly FieldContract[];
}

/** A composed operation's complete Definition compatibility contract. */
export interface DefinitionContract {
  readonly definitionRequirements: readonly DefinitionRequirement[];
  readonly identifier: string;
}

export interface ValidateDefinitionContractsInput {
  readonly contracts: readonly DefinitionContract[];
  readonly snapshot: CompiledSnapshot;
}

interface ContractIssueInput {
  readonly contentTypeIdentifier: string;
  readonly fieldPath: string | undefined;
  readonly message: string;
  readonly operationIdentifier: string;
  readonly reason: string;
}

interface FieldCompatibilityInput {
  readonly contract: DefinitionContract;
  readonly field: ResolvedField;
  readonly fieldContract: FieldContract;
  readonly requirement: DefinitionRequirement;
}

const contractIssue = ({
    contentTypeIdentifier,
    fieldPath,
    message,
    operationIdentifier,
    reason,
  }: ContractIssueInput): ValidationIssue => {
    const path = ["operations", operationIdentifier, "contentTypes", contentTypeIdentifier];
    if (fieldPath !== undefined) {
      path.push("fields", fieldPath);
    }
    return { message, path, reason };
  },
  defaultFormatVersion = 1,
  emptyIssueCount = 0,
  fieldFormatVersion = (field: ResolvedField): number => {
    if (field.kind.kind === "custom") {
      return field.kind.formatVersion;
    }
    if (field.kind.kind === "rich-text") {
      return field.kind.formatVersion ?? defaultFormatVersion;
    }
    return defaultFormatVersion;
  },
  fieldKindIdentifier = (field: ResolvedField): string => {
    if (field.kind.kind === "custom") {
      return field.kind.identifier;
    }
    return field.kind.kind;
  },
  findField = (fields: readonly ResolvedField[], path: string): ResolvedField | undefined => {
    const fieldPathSegments = path.split("."),
      [segment, ...remainingSegments] = fieldPathSegments,
      segmentField = fields.find((candidate) => candidate.key === segment);
    if (segment === undefined) {
      return undefined;
    }
    if (segmentField === undefined || remainingSegments.length === emptyIssueCount) {
      return segmentField;
    }
    return findField(segmentField.nestedFields ?? [], remainingSegments.join("."));
  },
  projectableFieldIssues = ({
    contract,
    field,
    fieldContract,
    requirement,
  }: FieldCompatibilityInput): readonly ValidationIssue[] => {
    if (fieldContract.projectable !== true || capabilitiesFor(field.kind).projectable === true) {
      return [];
    }
    return [
      contractIssue({
        contentTypeIdentifier: requirement.contentTypeId,
        fieldPath: fieldContract.path,
        message: `Operation ${contract.identifier} requires ${fieldContract.path} to remain projectable`,
        operationIdentifier: contract.identifier,
        reason: "fieldNotProjectable",
      }),
    ];
  },
  requiredFieldIssues = ({
    contract,
    field,
    fieldContract,
    requirement,
  }: FieldCompatibilityInput): readonly ValidationIssue[] => {
    if (fieldContract.required !== true || field.required === true) {
      return [];
    }
    return [
      contractIssue({
        contentTypeIdentifier: requirement.contentTypeId,
        fieldPath: fieldContract.path,
        message: `Operation ${contract.identifier} requires ${fieldContract.path} to remain required`,
        operationIdentifier: contract.identifier,
        reason: "fieldBecameOptional",
      }),
    ];
  },
  richTextExtensionIssues = ({
    contract,
    field,
    fieldContract,
    requirement,
  }: FieldCompatibilityInput): readonly ValidationIssue[] => {
    if (
      fieldContract.richTextExtensionIdentifiers === undefined ||
      field.kind.kind !== "rich-text"
    ) {
      return [];
    }
    const availableExtensions = new Set(field.kind.extensionIdentifiers),
      issues: ValidationIssue[] = [];
    for (const extensionIdentifier of fieldContract.richTextExtensionIdentifiers) {
      if (!availableExtensions.has(extensionIdentifier)) {
        issues.push(
          contractIssue({
            contentTypeIdentifier: requirement.contentTypeId,
            fieldPath: fieldContract.path,
            message: `Operation ${contract.identifier} requires Rich Text extension ${extensionIdentifier}`,
            operationIdentifier: contract.identifier,
            reason: "missingRichTextExtension",
          }),
        );
      }
    }
    return issues;
  },
  validatedFieldIssues = (input: FieldCompatibilityInput): readonly ValidationIssue[] => {
    const { contract, field, fieldContract, requirement } = input,
      issues: ValidationIssue[] = [
        ...projectableFieldIssues(input),
        ...requiredFieldIssues(input),
        ...richTextExtensionIssues(input),
      ];
    if (fieldKindIdentifier(field) !== fieldContract.kind) {
      issues.push(
        contractIssue({
          contentTypeIdentifier: requirement.contentTypeId,
          fieldPath: fieldContract.path,
          message: `Operation ${contract.identifier} requires ${fieldContract.kind}, received ${fieldKindIdentifier(field)}`,
          operationIdentifier: contract.identifier,
          reason: "incompatibleFieldKind",
        }),
      );
    }
    if (
      fieldContract.formatVersion !== undefined &&
      fieldFormatVersion(field) !== fieldContract.formatVersion
    ) {
      issues.push(
        contractIssue({
          contentTypeIdentifier: requirement.contentTypeId,
          fieldPath: fieldContract.path,
          message: `Operation ${contract.identifier} requires Field Kind version ${fieldContract.formatVersion}`,
          operationIdentifier: contract.identifier,
          reason: "incompatibleFieldKindVersion",
        }),
      );
    }
    return issues;
  },
  validatedRequirementIssues = (
    snapshot: CompiledSnapshot,
    contract: DefinitionContract,
    requirement: DefinitionRequirement,
  ): readonly ValidationIssue[] => {
    const contentType = snapshot.contentTypes.get(requirement.contentTypeId);
    if (contentType === undefined) {
      return [
        contractIssue({
          contentTypeIdentifier: requirement.contentTypeId,
          fieldPath: undefined,
          message: `Operation ${contract.identifier} requires Content Type ${requirement.contentTypeId}`,
          operationIdentifier: contract.identifier,
          reason: "missingContentType",
        }),
      ];
    }
    return requirement.fields.flatMap((fieldContract) => {
      const field = findField(contentType.fields, fieldContract.path);
      if (field === undefined) {
        return [
          contractIssue({
            contentTypeIdentifier: requirement.contentTypeId,
            fieldPath: fieldContract.path,
            message: `Operation ${contract.identifier} requires Field ${fieldContract.path}`,
            operationIdentifier: contract.identifier,
            reason: "missingField",
          }),
        ];
      }
      return validatedFieldIssues({ contract, field, fieldContract, requirement });
    });
  },
  validatedSnapshotIssues = ({
    contracts,
    snapshot,
  }: ValidateDefinitionContractsInput): readonly ValidationIssue[] =>
    contracts.flatMap((contract) =>
      contract.definitionRequirements.flatMap((requirement) =>
        validatedRequirementIssues(snapshot, contract, requirement),
      ),
    ),
  zValidateDefinitionContracts = (input: ValidateDefinitionContractsInput): void => {
    const issues = validatedSnapshotIssues(input);
    if (issues.length > emptyIssueCount) {
      throw InvalidInput.make({
        issues,
        message: "Content Definition Snapshot breaks a composed operation contract",
      });
    }
  };

/** Validates every operation contract against a compiled Definition Snapshot. */
export { zValidateDefinitionContracts as validateDefinitionContracts };
