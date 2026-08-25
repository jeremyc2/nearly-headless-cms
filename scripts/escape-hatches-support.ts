// Escape hatch registry CLI orchestration for scan, sync, and render workflows.
import { escapeHatchesDocumentPath, relativePath, scanEscapeHatches } from "./escape-hatches-parse-support.ts";
import { applyRegistryCodes } from "./escape-hatches-registry-support.ts";
const
  // oxlint-disable-next-line eslint/max-statements, eslint/sort-vars, eslint/max-lines-per-function -- [EH-219, EH-224, EH-118] escape hatch parsing and rendering are intentionally colocated.
  renderEscapeHatchesDocument = (
    entries: readonly {
      readonly code: string;
      readonly justification: string;
      readonly locations: readonly { readonly filePath: string; readonly lineNumber: number }[];
      readonly rule: string;
    }[],
  ): string => {
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
      "## Justification Registry",
      "",
    ],
     // oxlint-disable-next-line eslint/sort-vars -- [EH-132] registry helpers follow parse, assign, and render order.
     entriesByRule = new Map<string, (typeof entries)[number][]>();
    for (const entry of entries) {
      const existing = entriesByRule.get(entry.rule) ?? [];
      existing.push(entry);
      entriesByRule.set(entry.rule, existing);
    }
    // oxlint-disable-next-line eslint/one-var, unicorn/no-array-sort -- [EH-222, EH-209] registry keys are sorted in place before code assignment.
    const sortedRules = [...entriesByRule.keys()].sort();
    for (const rule of sortedRules) {
      lines.push(`### \`${rule}\``, "");
      const ruleEntries = entriesByRule.get(rule) ?? [];
      for (const entry of ruleEntries) {
        lines.push(`#### ${entry.code}: ${entry.justification}`, "", "**Locations:**", "");
        for (const location of entry.locations) {
          lines.push(`- \`${location.filePath}:${location.lineNumber}\``);
        }
        lines.push("");
      }
    }
    lines.push("## Code Index", "");
    for (const entry of entries) {
      lines.push(`- **${entry.code}** (\`${entry.rule}\`): ${entry.justification}`);
    }
    lines.push("");
    return lines.join("\n");
  },
  // oxlint-disable-next-line eslint/max-statements, effecttsgo/async-function -- [EH-220, EH-020] escape hatch registry CLI uses async filesystem IO.
  verifyEscapeHatches = async (): Promise<number> => {
    const hatches = await scanEscapeHatches();
    let missingCodeCount = 0;
    for (const hatch of hatches) {
      if (hatch.directive === "oxlint-disable") {
        // oxlint-disable-next-line effecttsgo/global-console -- [EH-077] escape hatch registry CLI reports to stdout and stderr.
        console.error(
          `File-wide oxlint disable forbidden at ${relativePath(hatch.filePath)}:${String(hatch.lineNumber)}`,
        );
        missingCodeCount += 1;
      }
      // oxlint-disable-next-line eslint/require-unicode-regexp -- [EH-127] registry parsing uses ASCII comment markers only.
      if (!/\[EH-\d{3}(?:,\s*EH-\d{3})*\]/.test(hatch.originalLine)) {
        // oxlint-disable-next-line effecttsgo/global-console -- [EH-077] escape hatch registry CLI reports to stdout and stderr.
        console.error(`Missing escape-hatch code at ${relativePath(hatch.filePath)}:${hatch.lineNumber}`);
        missingCodeCount += 1;
      }
    }
    // oxlint-disable-next-line eslint/one-var -- [EH-126] registry helpers keep related declarations grouped.
    const document = await Bun.file(escapeHatchesDocumentPath).text();
    if (document.length === 0) {
      // oxlint-disable-next-line effecttsgo/global-console -- [EH-077] escape hatch registry CLI reports to stdout and stderr.
      console.error("ESCAPE_HATCHES.md is missing.");
      missingCodeCount += 1;
    }
    return missingCodeCount;
  },
  // oxlint-disable-next-line eslint/sort-vars, effecttsgo/async-function -- [EH-225, EH-020] escape hatch registry CLI uses async filesystem IO.
  main = async (): Promise<void> => {
    const command = process.argv[2] ?? "sync";
    if (command === "verify") {
      const missingCodeCount = await verifyEscapeHatches();
      if (missingCodeCount > 0) {
        process.exitCode = 1;
      }
      return;
    }
    // oxlint-disable-next-line eslint/one-var -- [EH-126] registry helpers keep related declarations grouped.
    const hatches = await scanEscapeHatches(),
      { entries, updatedLineCount } = await applyRegistryCodes(hatches),
      // oxlint-disable-next-line eslint/sort-vars -- [EH-132] registry helpers follow parse, assign, and render order.
      document = renderEscapeHatchesDocument(entries);
    await Bun.write(escapeHatchesDocumentPath, document);
    // oxlint-disable-next-line effecttsgo/global-console -- [EH-077] escape hatch registry CLI reports to stdout and stderr.
    console.log(
      `Synced ${String(hatches.length)} escape hatch(es) across ${String(entries.length)} code(s); updated ${String(updatedLineCount)} line(s).`,
    );
  };

export { main };
