import type { Extension, ExtensionNode } from "./rich-text.ts";
import { type ValidationIssue } from "./cms-error.ts";
import { coreNodeTypes } from "./rich-text-validation-block-core-node-types.ts";
import inlineValidation from "./rich-text-validation-inline.ts";
import { isJsonValue } from "./internal/json.ts";

interface ExtensionChildrenInput {
  readonly extension: Extension;
  readonly extensions: ReadonlyMap<string, Extension>;
  readonly node: Readonly<Record<string, unknown>>;
  readonly path: readonly (string | number)[];
}

const coreNodeTypesSet = coreNodeTypes,
  emptyLength = 0,
  extensionNodePredicate = (node: unknown): node is ExtensionNode =>
    inlineValidation.isObject(node) &&
    typeof node["type"] === "string" &&
    extensionTypePredicate(node["type"]) &&
    typeof node["version"] === "number" &&
    isJsonValue(node["configuration"]) &&
    Array.isArray(node["children"]) &&
    !coreNodeTypesSet.has(node["type"]),
  extensionNodeValidationIssues = (
    node: Readonly<Record<string, unknown>>,
    path: readonly (string | number)[],
    extension: Extension,
  ): readonly ValidationIssue[] => {
    if (!extensionNodePredicate(node)) {
      return [];
    }
    return extension.validateNode(node).map((extensionIssue) =>
      Object.assign(extensionIssue, {
        path: [...path, ...extensionIssue.path],
      }),
    );
  },
  extensionTypePredicate = (type: string): type is `${string}.${string}` => {
    const separatorIndex = type.indexOf(".");
    return separatorIndex > emptyLength && separatorIndex < type.length - 1;
  },
  headingLevelFour = 4,
  headingLevelThree = 3,
  headingLevelTwo = 2,
  headingLevels = [headingLevelTwo, headingLevelThree, headingLevelFour] as const,
  makeIssue = (
    path: readonly (string | number)[],
    reason: string,
    message: string,
  ): ValidationIssue => ({ message, path, reason }),
  resolveExtension = (
    node: Readonly<Record<string, unknown>>,
    extensions: ReadonlyMap<string, Extension>,
  ): Extension | undefined => {
    const nodeType = node["type"],
      { version } = node;
    if (typeof nodeType !== "string" || typeof version !== "number") {
      return undefined;
    }
    return extensions.get(`${nodeType}@${String(version)}`);
  },
  validateAssetReference = (
    node: Readonly<Record<string, unknown>>,
    path: readonly (string | number)[],
  ): readonly ValidationIssue[] => {
    const issues: ValidationIssue[] = [];
    if (typeof node["assetId"] !== "string" || node["assetId"].length === emptyLength) {
      issues.push(
        makeIssue([...path, "assetId"], "expectedAssetId", "Asset reference requires an Asset ID"),
      );
    }
    if (typeof node["alternativeText"] !== "string") {
      issues.push(
        makeIssue(
          [...path, "alternativeText"],
          "expectedAlternativeText",
          "Asset reference requires authored alternative text",
        ),
      );
    }
    if (node["caption"] !== undefined && typeof node["caption"] !== "string") {
      issues.push(makeIssue([...path, "caption"], "expectedCaption", "Caption must be text"));
    }
    if (!Array.isArray(node["children"]) || node["children"].length > emptyLength) {
      issues.push(
        makeIssue(
          [...path, "children"],
          "assetReferenceIsAtomic",
          "Asset reference cannot contain children",
        ),
      );
    }
    return issues;
  },
  validateBlock = (
    node: unknown,
    path: readonly (string | number)[],
    extensions: ReadonlyMap<string, Extension>,
  ): readonly ValidationIssue[] => {
    if (!inlineValidation.isObject(node) || typeof node["type"] !== "string") {
      return [makeIssue(path, "invalidNode", "Expected a Rich Text block node")];
    }
    switch (node["type"]) {
      case "paragraph":
      case "heading": {
        return validateParagraphOrHeading(node, path);
      }
      case "quote": {
        return validateQuoteBlock(node, path, extensions);
      }
      case "code-block": {
        return validateCodeBlock(node, path);
      }
      case "ordered-list":
      case "unordered-list": {
        return validateListBlock(node, path, extensions);
      }
      case "asset-reference": {
        return validateAssetReference(node, path);
      }
      default: {
        return validateUnknownBlock(node, path, extensions);
      }
    }
  },
  validateCodeBlock = (
    node: Readonly<Record<string, unknown>>,
    path: readonly (string | number)[],
  ): readonly ValidationIssue[] => {
    if (!Array.isArray(node["children"])) {
      return [
        makeIssue([...path, "children"], "expectedTextLeaf", "Code block requires text leaves"),
      ];
    }
    return inlineValidation.validateTextChildren(node["children"], [...path, "children"]);
  },
  validateExtensionBlock = (
    node: Readonly<Record<string, unknown>>,
    path: readonly (string | number)[],
    extensions: ReadonlyMap<string, Extension>,
  ): readonly ValidationIssue[] => {
    const extension = resolveExtension(node, extensions);
    if (extension === undefined) {
      const nodeType = node["type"],
        { version } = node;
      return [
        makeIssue(
          path,
          "unsupportedExtension",
          `Unsupported Rich Text extension ${String(nodeType)}@${String(version)}`,
        ),
      ];
    }
    return [
      ...validateExtensionConfiguration(node, path, extension),
      ...validateExtensionChildren({ extension, extensions, node, path }),
      ...extensionNodeValidationIssues(node, path, extension),
    ];
  },
  validateExtensionChildren = ({
    extension,
    extensions,
    node,
    path,
  }: ExtensionChildrenInput): readonly ValidationIssue[] => {
    if (!Array.isArray(node["children"])) {
      return [
        makeIssue([...path, "children"], "expectedChildren", "Extension requires a children array"),
      ];
    }
    if (extension.allowedChildren === "none" && node["children"].length > emptyLength) {
      return [
        makeIssue([...path, "children"], "childrenNotAllowed", "Extension does not permit children"),
      ];
    }
    if (extension.allowedChildren === "inline") {
      return node["children"].flatMap((child, index) =>
        inlineValidation.validateInline(child, [...path, "children", index]),
      );
    }
    if (extension.allowedChildren === "block") {
      return node["children"].flatMap((child, index) =>
        validateBlock(child, [...path, "children", index], extensions),
      );
    }
    return [];
  },
  validateExtensionConfiguration = (
    node: Readonly<Record<string, unknown>>,
    path: readonly (string | number)[],
    extension: Extension,
  ): readonly ValidationIssue[] => {
    if (isJsonValue(node["configuration"])) {
      return extension.validateConfiguration(node["configuration"]).map((extensionIssue) =>
        Object.assign(extensionIssue, {
          path: [...path, "configuration", ...extensionIssue.path],
        }),
      );
    }
    return [
      makeIssue(
        [...path, "configuration"],
        "expectedJsonValue",
        "Extension configuration must be JSON-compatible",
      ),
    ];
  },
  validateListBlock = (
    node: Readonly<Record<string, unknown>>,
    path: readonly (string | number)[],
    extensions: ReadonlyMap<string, Extension>,
  ): readonly ValidationIssue[] => {
    if (!Array.isArray(node["children"]) || node["children"].length === emptyLength) {
      return [makeIssue([...path, "children"], "expectedListItem", "List requires List items")];
    }
    return node["children"].flatMap((child, index) => {
      const childPath = [...path, "children", index];
      if (
        !inlineValidation.isObject(child) ||
        child["type"] !== "list-item" ||
        !Array.isArray(child["children"])
      ) {
        return [makeIssue(childPath, "expectedListItem", "List children must be List items")];
      }
      return child["children"].flatMap((listChild, listChildIndex) =>
        validateBlock(listChild, [...childPath, "children", listChildIndex], extensions),
      );
    });
  },
  validateParagraphOrHeading = (
    node: Readonly<Record<string, unknown>>,
    path: readonly (string | number)[],
  ): readonly ValidationIssue[] => {
    const issues: ValidationIssue[] = [];
    if (
      node["type"] === "heading" &&
      !headingLevels.some((level) => level === Number(node["level"]))
    ) {
      issues.push(
        makeIssue([...path, "level"], "invalidHeadingLevel", "Heading level must be 2, 3, or 4"),
      );
    }
    if (Array.isArray(node["children"])) {
      issues.push(
        ...inlineValidation.validateInlineChildren(node["children"], [...path, "children"]),
      );
    } else {
      issues.push(
        makeIssue([...path, "children"], "expectedChildren", "Block requires inline children"),
      );
    }
    return issues;
  },
  validateQuoteBlock = (
    node: Readonly<Record<string, unknown>>,
    path: readonly (string | number)[],
    extensions: ReadonlyMap<string, Extension>,
  ): readonly ValidationIssue[] => {
    if (!Array.isArray(node["children"]) || node["children"].length === emptyLength) {
      return [
        makeIssue([...path, "children"], "expectedParagraph", "Quote requires paragraph children"),
      ];
    }
    return node["children"].flatMap((child, index) => {
      if (!inlineValidation.isObject(child) || child["type"] !== "paragraph") {
        return [
          makeIssue(
            [...path, "children", index],
            "expectedParagraph",
            "Quote children must be paragraphs",
          ),
        ];
      }
      return validateBlock(child, [...path, "children", index], extensions);
    });
  },
  validateUnknownBlock = (
    node: Readonly<Record<string, unknown>>,
    path: readonly (string | number)[],
    extensions: ReadonlyMap<string, Extension>,
  ): readonly ValidationIssue[] => {
    const nodeType = node["type"];
    if (typeof nodeType === "string" && coreNodeTypes.has(nodeType)) {
      return [
        makeIssue(path, "invalidBlockNode", `Node ${nodeType} is not allowed as a block`),
      ];
    }
    return validateExtensionBlock(node, path, extensions);
  };

export default { isObject: inlineValidation.isObject, validateBlock };
