/** Portable Entry Query inputs, predicates, sorts, limits, and pages. */
export type {
  AllPredicate,
  AnyPredicate,
  EvaluationInput,
  EvaluationOptions,
  FieldPredicate,
  NotPredicate,
  Predicate,
  PredicateOperator,
  Query,
  QueryLimits,
  QueryPage,
  Sort,
} from "./entry-query-types.ts";

/** Evaluates the portable Query algebra against an authoritative Entry set. */
export { evaluate } from "./entry-query-evaluation.ts";
