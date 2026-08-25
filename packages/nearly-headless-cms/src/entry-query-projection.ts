import { type JsonObject, type JsonValue, cloneJson, isJsonObject } from "./internal/json.ts";
import type { Representation } from "./entry.ts";
import entryQuerySupport from "./entry-query-support.ts";

const { ONE, valueAtPath } = entryQuerySupport,
  aNestedProjectedRecord = (existing: JsonValue | undefined): Record<string, JsonValue> => {
    if (isJsonObject(existing)) {
      return { ...existing };
    }
    return {};
  },
  bAssignProjectedSegment = <Projected extends Record<string, JsonValue>>(
    projected: Readonly<Projected>,
    segments: readonly string[],
    value: JsonValue,
  ): void => {
    let current = projected;
    for (const [index, segment] of segments.entries()) {
      if (index === segments.length - ONE) {
        current[segment] = cloneJson(value);
        return;
      }
      const nested = aNestedProjectedRecord(current[segment]);
      current[segment] = nested;
      current = nested;
    }
  },
  project = (entry: Representation, paths: readonly string[] | undefined): Representation => {
    if (paths === undefined) {
      return { ...entry, values: cloneJson(entry.values) };
    }
    const projected: JsonObject = {};
    for (const path of paths) {
      const value = valueAtPath(entry.values, path);
      if (value !== undefined) {
        bAssignProjectedSegment(projected, path.split("."), value);
      }
    }
    return { contentTypeId: entry.contentTypeId, id: entry.id, values: projected };
  };

export default { project };
