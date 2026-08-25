import type {
  CompiledSnapshot,
  EntryGeneration,
  EntryRecord,
  Representation,
  ResolvedField,
  Resource,
} from "./cms-entry-references-types.ts";
import { type JsonObject, type JsonValue, cloneJson, isJsonObject } from "./cms-entry-references-imports.ts";

interface SetProjectedValueInput {
  segments: readonly string[];
  value: JsonValue;
  values: Record<string, JsonValue>;
}

const valueAtPath = (values: Readonly<JsonObject>, path: readonly string[]): JsonValue | undefined => {
    let current: JsonValue | undefined = values;
    for (const segment of path) {
      if (!isJsonObject(current)) {
        return undefined;
      }
      current = current[segment];
    }
    return current;
  },
  // oxlint-disable-next-line eslint/sort-vars -- [EH-131] helper declaration order follows dependency order.
  setProjectedValue = (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-191] mutable values out-param is bundled in input interface.
    input: Readonly<SetProjectedValueInput>,
  ): void => {
    let current = input.values;
    for (const [index, segment] of input.segments.entries()) {
      if (index === input.segments.length - 1) {
        current[segment] = cloneJson(input.value);
      } else {
        const existing = current[segment];
        let nested: Record<string, JsonValue> = {};
        if (isJsonObject(existing)) {
          nested = { ...existing };
        }
        current[segment] = nested;
        current = nested;
      }
    }
  },
  // oxlint-disable-next-line eslint/sort-vars -- [EH-131] helper declaration order follows dependency order.
  fieldsAtPaths = (
    fields: readonly ResolvedField[],
    parentPath: readonly string[] = [],
  ): readonly { readonly field: ResolvedField; readonly path: readonly string[] }[] =>
    fields.flatMap((field) => {
      const path = [...parentPath, field.key];
      let descendants: readonly {
        readonly field: ResolvedField;
        readonly path: readonly string[];
      }[] = [];
      if (field.nestedFields !== undefined) {
        descendants = fieldsAtPaths(field.nestedFields, path);
      }
      return [{ field, path }, ...descendants];
    }),
  // oxlint-disable-next-line eslint/sort-vars -- [EH-131] helper declaration order follows dependency order.
  entryResource = (
    snapshot: Readonly<CompiledSnapshot>,
    contentTypeId: string,
    entryId?: string,
  ): Resource => {
    const base = {
      contentTypeId,
      definitionSpaceId: snapshot.definitionSpaceId,
      kind: "entry",
    } as const;
    if (entryId === undefined) {
      return base;
    }
    return { ...base, entryId };
  },
  liveRecords = (generation: Readonly<EntryGeneration>): readonly EntryRecord[] =>
    [...generation.records.values()].filter((record) => record.deletionRecord === undefined),
  // oxlint-disable-next-line eslint/sort-vars -- [EH-131] helper declaration order follows dependency order.
  project = (
    entry: Readonly<Representation>,
    projection: readonly string[] | undefined,
  ): Representation => {
    if (projection === undefined) {
      return structuredClone(entry);
    }
    const values: Record<string, JsonValue> = {};
    for (const path of projection) {
      const pathSegments = path.split("."),
        projectedValue = valueAtPath(entry.values, pathSegments);
      if (projectedValue === undefined) {
        // Skip absent projection paths.
      } else {
        setProjectedValue({ segments: pathSegments, value: projectedValue, values });
      }
    }
    return { contentTypeId: entry.contentTypeId, id: entry.id, values };
  };

export default { entryResource, fieldsAtPaths, liveRecords, project, setProjectedValue, valueAtPath };
