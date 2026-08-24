import expansionSupport from "./cms-entry-expansion-support.ts";
import referencesSupport from "./cms-entry-references-support.ts";

export type { EnsureUniqueValuesInput, References } from "./cms-entry-references-support.ts";

export default {
  ...referencesSupport,
  ...expansionSupport,
};
