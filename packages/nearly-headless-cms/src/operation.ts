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

export interface DeliveryOperation<Request, Response> {
  readonly identifier: string;
  readonly method: "GET" | "POST" | "PUT" | "DELETE" | "HEAD";
  readonly path: string;
  readonly reachableContentTypeIds: readonly string[];
  readonly requiresIdempotencyKey?: boolean;
  readonly handler: (request: Request) => Response;
}

/** One Field shape that a composed operation promises on its public wire contract. */
export interface FieldContract {
  readonly path: string;
  /** Built-in Field Kind or registered Custom Field Kind identifier. */
  readonly kind: string;
  readonly formatVersion?: number;
  readonly required?: boolean;
  readonly projectable?: boolean;
  readonly richTextExtensionIdentifiers?: readonly string[];
}

/** Content Definition surface used by one composed Delivery or Management operation. */
export interface DefinitionRequirement {
  readonly contentTypeId: string;
  readonly fields: readonly FieldContract[];
}

/** Definition-dependent portion of a stable composed operation contract. */
export interface DefinitionContract {
  readonly identifier: string;
  readonly definitionRequirements: readonly DefinitionRequirement[];
}

const findField = (
    fields: readonly ResolvedField[],
    path: string,
  ): ResolvedField | undefined => {
    const segments = path.split(".");
    let candidates = fields,
      field: ResolvedField | undefined;
    for (const segment of segments) {
      field = candidates.find((candidate) => candidate.key === segment);
      if (field === undefined) {
        return undefined;
      }
      candidates = field.nestedFields ?? [];
    }
    return field;
  },
  fieldKindIdentifier = (field: ResolvedField): string =>
    field.kind.kind === "custom" ? field.kind.identifier : field.kind.kind,
  fieldFormatVersion = (field: ResolvedField): number => {
    if (field.kind.kind === "custom") {
      return field.kind.formatVersion;
    }
    return field.kind.kind === "rich-text" ? (field.kind.formatVersion ?? 1) : 1;
  },
  contractIssue = (
    operationIdentifier: string,
    contentTypeIdentifier: string,
    fieldPath: string | undefined,
    reason: string,
    message: string,
  ): ValidationIssue => ({
    message,
    path: [
      "operations",
      operationIdentifier,
      "contentTypes",
      contentTypeIdentifier,
      ...(fieldPath === undefined ? [] : ["fields", fieldPath]),
    ],
    reason,
  });

/**
 * Revalidates every Definition-dependent operation promise against a candidate
 * immutable Definition Snapshot. It throws `InvalidInput` before activation can
 * mutate either the Catalog or Entry generation.
 */
export const validateDefinitionContracts = (
  snapshot: CompiledSnapshot,
  contracts: readonly DefinitionContract[],
): void => {
  const issues: ValidationIssue[] = [];
  for (const contract of contracts) {
    for (const requirement of contract.definitionRequirements) {
      const contentType = snapshot.contentTypes.get(requirement.contentTypeId);
      if (contentType === undefined) {
        issues.push(
          contractIssue(
            contract.identifier,
            requirement.contentTypeId,
            undefined,
            "missingContentType",
            `Operation ${contract.identifier} requires Content Type ${requirement.contentTypeId}`,
          ),
        );
        continue;
      }
      for (const fieldContract of requirement.fields) {
        const field = findField(contentType.fields, fieldContract.path);
        if (field === undefined) {
          issues.push(
            contractIssue(
              contract.identifier,
              requirement.contentTypeId,
              fieldContract.path,
              "missingField",
              `Operation ${contract.identifier} requires Field ${fieldContract.path}`,
            ),
          );
          continue;
        }
        if (fieldKindIdentifier(field) !== fieldContract.kind) {
          issues.push(
            contractIssue(
              contract.identifier,
              requirement.contentTypeId,
              fieldContract.path,
              "incompatibleFieldKind",
              `Operation ${contract.identifier} requires ${fieldContract.kind}, received ${fieldKindIdentifier(field)}`,
            ),
          );
        }
        if (
          fieldContract.formatVersion !== undefined &&
          fieldFormatVersion(field) !== fieldContract.formatVersion
        ) {
          issues.push(
            contractIssue(
              contract.identifier,
              requirement.contentTypeId,
              fieldContract.path,
              "incompatibleFieldKindVersion",
              `Operation ${contract.identifier} requires Field Kind version ${fieldContract.formatVersion}`,
            ),
          );
        }
        if (fieldContract.required === true && field.required !== true) {
          issues.push(
            contractIssue(
              contract.identifier,
              requirement.contentTypeId,
              fieldContract.path,
              "fieldBecameOptional",
              `Operation ${contract.identifier} requires ${fieldContract.path} to remain required`,
            ),
          );
        }
        if (fieldContract.projectable === true && field.kind.capabilities?.projectable === false) {
          issues.push(
            contractIssue(
              contract.identifier,
              requirement.contentTypeId,
              fieldContract.path,
              "fieldNotProjectable",
              `Operation ${contract.identifier} requires ${fieldContract.path} to remain projectable`,
            ),
          );
        }
        if (
          fieldContract.richTextExtensionIdentifiers !== undefined &&
          field.kind.kind === "rich-text"
        ) {
          const availableExtensions = new Set(field.kind.extensionIdentifiers ?? []);
          for (const extensionIdentifier of fieldContract.richTextExtensionIdentifiers) {
            if (!availableExtensions.has(extensionIdentifier)) {
              issues.push(
                contractIssue(
                  contract.identifier,
                  requirement.contentTypeId,
                  fieldContract.path,
                  "missingRichTextExtension",
                  `Operation ${contract.identifier} requires Rich Text extension ${extensionIdentifier}`,
                ),
              );
            }
          }
        }
      }
    }
  }
  if (issues.length > 0) {
    throw InvalidInput.make({
      issues,
      message: "Content Definition Snapshot breaks a composed operation contract",
    });
  }
};
import type { CompiledSnapshot, ResolvedField } from "./content-definition.ts";
import { InvalidInput, type ValidationIssue } from "./cms-error.ts";
