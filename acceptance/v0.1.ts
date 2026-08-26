export type VerificationLevel =
  | "unit"
  | "type"
  | "contract"
  | "integration"
  | "filesystem"
  | "journey"
  | "visual"
  | "package"
  | "architecture";

export interface AcceptanceCase {
  readonly id: string;
  readonly source: string;
  readonly claim: string;
  readonly level: VerificationLevel;
  readonly owner: "library" | "example-cms" | "public-blog" | "cross-system";
  readonly command: string;
  readonly selector: string;
  readonly runtime: string;
  readonly operatingSystem: string;
  readonly adapter: string;
  readonly externalProcess: string;
  readonly automation: "automated";
  readonly evidence: readonly string[];
  readonly limitation?: string;
}

export { acceptanceCases } from "./v0.1-cases.ts";
