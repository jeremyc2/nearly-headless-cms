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

export interface ManualAcceptanceCaseInput {
  readonly claim: string;
  readonly id: string;
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
  }: AutomatedAcceptanceCaseInput): AcceptanceCase => ({
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
  }),
  manual = ({ claim, id, selector, source }: ManualAcceptanceCaseInput): AcceptanceCase => ({
    adapter: "filesystem",
    automation: "manual",
    claim,
    command: "docs/manual/v0.1-release-checklist.md",
    evidence: ["signed release-candidate checklist"],
    externalProcess: "Safari, Chrome, Firefox, VoiceOver, Japanese IME",
    id,
    level: "manual",
    limitation:
      "Claim is limited to the recorded versions and macOS desktop keyboard/mouse authoring.",
    operatingSystem: "macOS",
    owner: "cross-system",
    runtime: "Bun 1.4.0",
    selector,
    source,
  });
