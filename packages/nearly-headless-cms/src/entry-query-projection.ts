import { type JsonObject, type JsonValue, cloneJson, isJsonObject } from "./internal/json.ts";
import type { Representation } from "./entry.ts";
import entryQuerySupport from "./entry-query-support.ts";

const { ONE, valueAtPath } = entryQuerySupport;

interface AssignProjectedSegmentInput {
  projected: Record<string, JsonValue>;
  segments: readonly string[];
  value: JsonValue;
}

// oxlint-disable-next-line eslint/one-var -- [EH-125] helpers with readonly disables must stay as separate const declarations.
const aNestedProjectedRecord = (existing: JsonValue | undefined): Record<string, JsonValue> => {
  if (isJsonObject(existing)) {
    return { ...existing };
  }
  return {};
},

 bAssignProjectedSegment = (
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-189] mutable projected out-param is bundled in input interface.
  input: Readonly<AssignProjectedSegmentInput>,
): void => {
  let current = input.projected;
  for (const [index, segment] of input.segments.entries()) {
    if (index === input.segments.length - ONE) {
      current[segment] = cloneJson(input.value);
      return;
    }
    const nested = aNestedProjectedRecord(current[segment]);
    current[segment] = nested;
    current = nested;
  }
},

 project = (entry: Readonly<Representation>, paths: readonly string[] | undefined): Representation => {
  if (paths === undefined) {
    return { ...entry, values: cloneJson(entry.values) };
  }
  const projected: JsonObject = {};
  for (const path of paths) {
    const value = valueAtPath(entry.values, path);
    if (value !== undefined) {
      bAssignProjectedSegment({ projected, segments: path.split("."), value });
    }
  }
  return { contentTypeId: entry.contentTypeId, id: entry.id, values: projected };
};

export default { project };
