const listComponentSchemaNames = (document: Readonly<Record<string, unknown>>): readonly string[] =>
    Object.keys(
      requireRecord(
        requireRecord(document["components"], "components")["schemas"],
        "component schemas",
      ),
    ).toSorted((leftName, rightName) => leftName.localeCompare(rightName)),
  requireRecord = (value: unknown, description: string): Readonly<Record<string, unknown>> => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`OpenAPI generator expected ${description}`);
    }
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- OpenAPI schema objects are validated as non-null objects before use.
    return value as Readonly<Record<string, unknown>>;
  };

export { listComponentSchemaNames };
