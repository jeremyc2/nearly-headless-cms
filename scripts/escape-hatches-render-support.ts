interface EscapeHatchRegistryEntry {
  readonly code: string;
  readonly justification: string;
  readonly locations: readonly { readonly filePath: string; readonly lineNumber: number }[];
  readonly rule: string;
}

const compareEscapeHatchCodes = (left: string, right: string): number =>
    escapeHatchCodeNumber(left) - escapeHatchCodeNumber(right),
  compareRulesByFamily = (left: string, right: string): number => {
    const leftFamily = ruleFamily(left),
      rightFamily = ruleFamily(right);
    if (leftFamily.order !== rightFamily.order) {
      return leftFamily.order - rightFamily.order;
    }
    return left.localeCompare(right);
  },
  escapeHatchCodeNumber = (code: string): number => {
    // oxlint-disable-next-line eslint/require-unicode-regexp -- [EH-127] registry parsing uses ASCII comment markers only.
    const match = /^EH-(?<number>\d{3})$/u.exec(code);
    if (match?.groups?.["number"] === undefined) {
      return Number.MAX_SAFE_INTEGER;
    }
    // oxlint-disable-next-line unicorn/prefer-number-coercion -- [EH-214] registry code numbers are parsed from fixed-width labels.
    return Number.parseInt(match.groups["number"], 10);
  },
  renderCodeIndex = (
    entries: readonly EscapeHatchRegistryEntry[],
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-239] document line buffer is mutated while rendering the registry.
    lines: string[],
  ): void => {
    lines.push("## Code Index", "", "Sorted by escape-hatch code (`EH-###`).", "");
    for (const entry of sortRegistryEntries(entries)) {
      lines.push(`- **${entry.code}** (\`${entry.rule}\`): ${entry.justification}`);
    }
    lines.push("");
  },
  // oxlint-disable-next-line eslint/max-statements, eslint/max-lines-per-function -- [EH-241, EH-240] escape hatch document rendering is intentionally colocated.
  renderEscapeHatchesDocument = (entries: readonly EscapeHatchRegistryEntry[]): string => {
    const lines = [
      "# Escape Hatches",
      "",
      "This document tracks every lint and type-check escape hatch in the repository.",
      "",
      "We prefer strict linting and type-checking. Each escape hatch below is intentional,",
      "documented, and assigned a stable code for review and remediation.",
      "",
      "## Conventions",
      "",
      "When you must disable a rule:",
      "",
      "1. Prefer fixing the underlying issue over adding an escape hatch.",
      "2. Never use file-wide `// oxlint-disable` or `/* oxlint-disable */`; use `// oxlint-disable-next-line` on the specific line instead.",
      "3. Every escape hatch must include both a **code** and a **justification** in this format:",
      "",
      "   ```ts",
      "   // oxlint-disable-next-line <rule> -- [EH-042] <justification>",
      "   ```",
      "",
      "   ```ts",
      "   // @ts-expect-error [EH-042] <justification>",
      "   ```",
      "",
      "4. Regenerate this file with `bun run scripts/escape-hatches.ts sync` when adding or changing an escape hatch.",
      "5. Run `bun run check:escape-hatches` to verify every escape hatch has a code and this file exists.",
      "",
    ];
    renderCodeIndex(entries, lines);
    renderJustificationRegistry(entries, lines);
    return lines.join("\n");
  },
  // oxlint-disable-next-line eslint/max-statements -- [EH-242] registry rendering keeps family grouping colocated.
  renderJustificationRegistry = (
    entries: readonly EscapeHatchRegistryEntry[],
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-239] document line buffer is mutated while rendering the registry.
    lines: string[],
  ): void => {
    lines.push(
      "## Justification Registry",
      "",
      "Grouped by linter family and rule. Entries within each rule are sorted by code.",
      "",
    );
    const entriesByRule = new Map<string, EscapeHatchRegistryEntry[]>();
    for (const entry of entries) {
      const existing = entriesByRule.get(entry.rule) ?? [];
      existing.push(entry);
      entriesByRule.set(entry.rule, existing);
    }
    for (const rule of [...entriesByRule.keys()].toSorted(compareRulesByFamily)) {
      const family = ruleFamily(rule);
      lines.push(`### ${family.title} · \`${rule}\``, "");
      for (const entry of sortRegistryEntries(entriesByRule.get(rule) ?? [])) {
        lines.push(`#### ${entry.code}: ${entry.justification}`, "", "**Locations:**", "");
        for (const location of entry.locations) {
          lines.push(`- \`${location.filePath}:${location.lineNumber}\``);
        }
        lines.push("");
      }
    }
  },
  ruleFamily = (
    rule: string,
  ): {
    readonly order: number;
    readonly title: string;
  } => {
    if (rule.startsWith("@ts-") || rule.startsWith("typescript/")) {
      return { order: 0, title: "TypeScript" };
    }
    if (rule.startsWith("effecttsgo/")) {
      return { order: 1, title: "Effect" };
    }
    if (rule.startsWith("eslint/") || rule === "no-await-in-loop") {
      return { order: 2, title: "ESLint" };
    }
    if (rule.startsWith("unicorn/")) {
      return { order: 3, title: "Unicorn" };
    }
    return { order: 4, title: "Other" };
  },
  sortRegistryEntries = (
    entries: readonly EscapeHatchRegistryEntry[],
  ): EscapeHatchRegistryEntry[] =>
    [...entries].toSorted((left, right) => {
      const codeComparison = compareEscapeHatchCodes(left.code, right.code),
        ruleComparison = left.rule.localeCompare(right.rule);
      if (codeComparison !== 0) {
        return codeComparison;
      }
      if (ruleComparison !== 0) {
        return ruleComparison;
      }
      return left.justification.localeCompare(right.justification);
    });

export { renderEscapeHatchesDocument };
export type { EscapeHatchRegistryEntry };
