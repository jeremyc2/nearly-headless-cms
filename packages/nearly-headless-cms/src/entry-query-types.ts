import type { CompiledSnapshot } from "./content-definition.ts";
import type { JsonValue } from "./internal/json.ts";
import type { Representation } from "./entry.ts";

export { capabilitiesFor } from "./content-definition.ts";

/** Portable scalar predicate operations with exact cross-adapter semantics. */
export type PredicateOperator =
  | "equals"
  | "notEquals"
  | "in"
  | "notIn"
  | "lessThan"
  | "lessThanOrEqual"
  | "greaterThan"
  | "greaterThanOrEqual"
  | "startsWith"
  | "contains"
  | "isNull";

/** A predicate over one resolvable Field path. */
export interface FieldPredicate {
  readonly path: string;
  readonly operator: PredicateOperator;
  readonly value?: JsonValue;
}

/** A predicate requiring every child predicate to match. */
export interface AllPredicate {
  readonly all: readonly Predicate[];
}

/** A predicate requiring at least one child predicate to match. */
export interface AnyPredicate {
  readonly any: readonly Predicate[];
}

/** A predicate negating one child predicate. */
export interface NotPredicate {
  readonly not: Predicate;
}

/** The recursive portable Entry Query predicate algebra. */
export type Predicate = FieldPredicate | AllPredicate | AnyPredicate | NotPredicate;

/** One deterministic Field-path sort followed implicitly by Entry ID. */
export interface Sort {
  readonly path: string;
  readonly direction: "ascending" | "descending";
}

/** A bounded Query over exactly one Content Type. */
export interface Query {
  readonly contentTypeId: string;
  readonly where?: Predicate;
  readonly sort?: readonly Sort[];
  readonly projection?: readonly string[];
  readonly expansion?: readonly string[];
  readonly pageSize: number;
  readonly cursor?: string;
}

/** One internally consistent cursor page of Entry representations. */
export interface QueryPage {
  readonly items: readonly Representation[];
  readonly nextCursor?: string;
}

/** Hard complexity and page-size bounds applied before Query evaluation. */
export interface QueryLimits {
  readonly maximumPageSize: number;
  readonly maximumProjectionPaths: number;
  readonly maximumExpansionPaths: number;
  readonly maximumScanEntries: number;
}

/** Compiled Definition and Adapter capability inputs for portable evaluation. */
export interface EvaluationOptions {
  readonly generation: number;
  readonly limits?: Partial<QueryLimits>;
}

/** Complete inputs for one deterministic Query evaluation. */
export interface EvaluationInput {
  readonly entries: readonly Representation[];
  readonly options: EvaluationOptions;
  readonly query: Query;
  readonly snapshot: CompiledSnapshot;
}

export type { JsonObject, JsonValue } from "./internal/json.ts";
export type { Representation } from "./entry.ts";
export type { ResolvedField } from "./content-definition.ts";
