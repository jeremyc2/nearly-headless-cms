import type { AcceptanceCase, VerificationLevel } from "./v0.1.ts";
export interface AutomatedAcceptanceCaseInput {
  readonly adapter?: string;
  readonly claim: string;
  readonly command: string;
  readonly id: string;
  readonly level: VerificationLevel;
  readonly owner: AcceptanceCase["owner"];
  readonly selector: string;
  readonly source: string;
}

export const acceptanceExternalProcess = (level: VerificationLevel): string => {
    if (level === "journey" || level === "visual") {
      return "Example CMS and Public Blog";
    }
    return "none";
  },
  automated = ({
    adapter = "memory",
    claim,
    command,
    id,
    level,
    owner,
    selector,
    source,
  }: Readonly<AutomatedAcceptanceCaseInput>): AcceptanceCase => ({
    adapter,
    automation: "automated",
    claim,
    command,
    evidence: ["test result", "command log"],
    externalProcess: acceptanceExternalProcess(level),
    id,
    level,
    operatingSystem: "portable unless named",
    owner,
    runtime: "Bun 1.4.0",
    selector,
    source,
  });
