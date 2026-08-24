import type { AcceptanceCase } from "./v0.1.ts";
import { acceptanceCasesA } from "./v0.1-cases-a.ts";
import { acceptanceCasesB } from "./v0.1-cases-b.ts";

export const acceptanceCases: readonly AcceptanceCase[] = [
  ...acceptanceCasesA,
  ...acceptanceCasesB,
];
