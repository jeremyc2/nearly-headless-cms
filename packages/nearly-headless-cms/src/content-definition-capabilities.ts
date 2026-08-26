import type { FieldKind, QueryCapabilities } from "./content-definition-types.ts";

const assetCapabilities = (): QueryCapabilities => ({
    filter: ["equals", "notEquals", "isNull"],
    projectable: true,
  }),
  capabilitiesFor = (fieldKind: FieldKind): QueryCapabilities =>
    fieldKind.capabilities ?? defaultCapabilities(fieldKind),
  comparisonFilterCapabilities = (): QueryCapabilities => ({
    filter: [
      "equals",
      "notEquals",
      "in",
      "notIn",
      "lessThan",
      "lessThanOrEqual",
      "greaterThan",
      "greaterThanOrEqual",
      "isNull",
    ],
    projectable: true,
    sortable: true,
  }),
  customCapabilities = (fieldKind: Extract<FieldKind, { kind: "custom" }>): QueryCapabilities =>
    fieldKind.capabilities ?? {},
  defaultCapabilities = (fieldKind: FieldKind): QueryCapabilities => {
    switch (fieldKind.kind) {
      case "text": {
        return textFilterCapabilities();
      }
      case "integer":
      case "number":
      case "date":
      case "datetime": {
        return comparisonFilterCapabilities();
      }
      case "boolean":
      case "url":
      case "email":
      case "enum": {
        return equalityFilterCapabilities();
      }
      case "asset": {
        return assetCapabilities();
      }
      case "relationship": {
        return relationshipCapabilities();
      }
      case "list": {
        return listCapabilities(fieldKind);
      }
      case "json":
      case "rich-text": {
        return projectableOnlyCapabilities();
      }
      case "custom": {
        return customCapabilities(fieldKind);
      }
    }
    return fieldKind;
  },
  equalityFilterCapabilities = (): QueryCapabilities => ({
    filter: ["equals", "notEquals", "in", "notIn", "isNull"],
    projectable: true,
    sortable: true,
  }),
  listCapabilities = (fieldKind: Extract<FieldKind, { kind: "list" }>): QueryCapabilities => {
    if (fieldKind.element.kind === "relationship") {
      return assetCapabilities();
    }
    return projectableOnlyCapabilities();
  },
  projectableOnlyCapabilities = (): QueryCapabilities => ({ projectable: true }),
  relationshipCapabilities = (): QueryCapabilities => ({
    expandable: true,
    filter: ["equals", "notEquals", "in", "notIn", "isNull"],
    projectable: true,
  }),
  textFilterCapabilities = (): QueryCapabilities => ({
    filter: ["equals", "notEquals", "in", "notIn", "startsWith", "contains", "isNull"],
    projectable: true,
    sortable: true,
  });

/** Returns the effective portable Query capabilities for a Field Kind. */
export { capabilitiesFor };
