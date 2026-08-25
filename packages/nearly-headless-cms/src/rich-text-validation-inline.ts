import type { ValidationIssue } from "./cms-error.ts";

const emptyLength = 0,
  isObject = (value: unknown): value is Readonly<Record<string, unknown>> =>
    value !== null && typeof value === "object" && !Array.isArray(value),
  makeIssue = (
    path: readonly (string | number)[],
    reason: string,
    message: string,
  ): ValidationIssue => ({ message, path, reason }),
  validateEntryReference = (
    node: Readonly<Record<string, unknown>>,
    path: readonly (string | number)[],
  ): readonly ValidationIssue[] => {
    const issues: ValidationIssue[] = [];
    if (typeof node["entryId"] !== "string" || node["entryId"].length === emptyLength) {
      issues.push(
        makeIssue([...path, "entryId"], "expectedEntryId", "Entry reference requires an Entry ID"),
      );
    }
    if (!Array.isArray(node["children"]) || node["children"].length === emptyLength) {
      issues.push(
        makeIssue(
          [...path, "children"],
          "requiredLabel",
          "Entry reference requires an authored label",
        ),
      );
    } else {
      for (const [index, child] of node["children"].entries()) {
        issues.push(...validateTextChild(child, [...path, "children", index]));
      }
    }
    return issues;
  },
  validateInline = (
    node: unknown,
    path: readonly (string | number)[],
  ): readonly ValidationIssue[] => {
    if (!isObject(node) || typeof node["type"] !== "string") {
      return [makeIssue(path, "invalidNode", "Expected a Rich Text inline node")];
    }
    switch (node["type"]) {
      case "text": {
        return validateText(node, path);
      }
      case "link": {
        return validateLink(node, path);
      }
      case "entry-reference": {
        return validateEntryReference(node, path);
      }
      default: {
        return [makeIssue(path, "invalidInlineNode", `Node ${node["type"]} is not allowed inline`)];
      }
    }
  },
  validateInlineChildren = <Children extends readonly unknown[]>(
    children: Readonly<Children>,
    path: readonly (string | number)[],
  ): readonly ValidationIssue[] =>
    children.flatMap((child, index) => validateInline(child, [...path, index])),
  validateLink = (
    node: Readonly<Record<string, unknown>>,
    path: readonly (string | number)[],
  ): readonly ValidationIssue[] => {
    const issues: ValidationIssue[] = [];
    if (typeof node["url"] !== "string" || !URL.canParse(node["url"])) {
      issues.push(makeIssue([...path, "url"], "expectedUrl", "Link requires a valid URL"));
    }
    if (Array.isArray(node["children"])) {
      for (const [index, child] of node["children"].entries()) {
        issues.push(...validateTextChild(child, [...path, "children", index]));
      }
    } else {
      issues.push(
        makeIssue([...path, "children"], "expectedChildren", "Link requires text children"),
      );
    }
    return issues;
  },
  validateText = (
    node: Readonly<Record<string, unknown>>,
    path: readonly (string | number)[],
  ): readonly ValidationIssue[] => {
    const issues: ValidationIssue[] = [],
      { marks } = node;
    if (typeof node["text"] !== "string") {
      issues.push(makeIssue([...path, "text"], "expectedText", "Text leaves require text"));
    }
    if (
      marks !== undefined &&
      (!Array.isArray(marks) ||
        marks.some((mark) => !["bold", "italic", "code", "strikethrough"].includes(String(mark))) ||
        new Set(marks).size !== marks.length)
    ) {
      issues.push(
        makeIssue([...path, "marks"], "invalidMarks", "Marks must be distinct core semantic marks"),
      );
    }
    return issues;
  },
  validateTextChild = (
    node: unknown,
    path: readonly (string | number)[],
  ): readonly ValidationIssue[] => {
    if (!isObject(node) || node["type"] !== "text") {
      return [
        makeIssue(
          path,
          "expectedTextLeaf",
          "Links and Entry references can contain only text leaves",
        ),
      ];
    }
    return validateText(node, path);
  },
  validateTextChildren = <Children extends readonly unknown[]>(
    children: Readonly<Children>,
    path: readonly (string | number)[],
  ): readonly ValidationIssue[] =>
    children.flatMap((child, index) => validateTextChild(child, [...path, index]));

export default {
  isObject,
  validateInline,
  validateInlineChildren,
  validateText,
  validateTextChild,
  validateTextChildren,
};
