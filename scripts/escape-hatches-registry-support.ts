// Escape hatch code assignment and source file update helpers.
import {
  type EscapeHatch,
  escapeHatchesDocumentPath,
  parseCommentContent,
  relativePath,
} from "./escape-hatches-parse-support.ts";

const registryCodeWidth = 3,
  // oxlint-disable-next-line eslint/sort-vars -- [EH-132] registry helpers follow parse, assign, and render order.
  justificationKey = (rule: string, justification: string): string => `${rule}\0${justification}`,
  // oxlint-disable-next-line eslint/max-statements, effecttsgo/async-function -- [EH-220, EH-020] escape hatch registry CLI uses async filesystem IO.
  loadExistingCodes = async (): Promise<ReadonlyMap<string, string>> => {
    const documentFile = Bun.file(escapeHatchesDocumentPath);
    if (!(await documentFile.exists())) {
      return new Map();
    }
    // oxlint-disable-next-line eslint/one-var -- [EH-126] registry helpers keep related declarations grouped.
    const document = await documentFile.text(),
      // oxlint-disable-next-line eslint/sort-vars -- [EH-132] registry helpers follow parse, assign, and render order.
      codeByKey = new Map<string, string>(),
      indexLinePattern =
        /^- \*\*(?<code>EH-\d{3})\*\* \(`(?<rule>[^`]+)`\): (?<justification>.+)$/u;
    for (const line of document.split("\n")) {
      const match = indexLinePattern.exec(line);
      if (match?.groups === undefined) {
        // oxlint-disable-next-line eslint/no-continue -- [EH-121] registry assignment skips unresolved rule and code pairs.
        continue;
      }
      // oxlint-disable-next-line eslint/one-var -- [EH-126] registry helpers keep related declarations grouped.
      const rule = match.groups["rule"] ?? "",
        // oxlint-disable-next-line eslint/sort-vars -- [EH-132] registry helpers follow parse, assign, and render order.
        justification = match.groups["justification"] ?? "",
        // oxlint-disable-next-line eslint/sort-vars -- [EH-132] registry helpers follow parse, assign, and render order.
        code = match.groups["code"] ?? "";
      codeByKey.set(justificationKey(rule, justification), code);
    }
    return codeByKey;
  },
  nextRegistryCode = (assignedCodes: ReadonlySet<string>): string => {
    let maximumCodeNumber = 0;
    for (const code of assignedCodes) {
      // oxlint-disable-next-line unicorn/prefer-number-coercion -- [EH-214] registry code numbers are parsed from fixed-width labels.
      const codeNumber = Number.parseInt(code.replace("EH-", ""), 10);
      if (!Number.isNaN(codeNumber) && codeNumber > maximumCodeNumber) {
        maximumCodeNumber = codeNumber;
      }
    }
    return `EH-${String(maximumCodeNumber + 1).padStart(registryCodeWidth, "0")}`;
  },
  // oxlint-disable-next-line eslint/max-statements, eslint/sort-vars -- [EH-229, EH-232] registry formatting keeps comment rendering colocated.
  formatInlineComment = (hatch: EscapeHatch, codes: readonly string[]): string => {
    const comment = parseCommentContent(hatch.originalLine),
      indent = comment?.indent ?? "",
      kind = comment?.kind ?? "line",
    // oxlint-disable-next-line eslint/no-ternary, eslint/sort-vars, unicorn/prefer-ternary -- [EH-124, EH-226, EH-234] registry formatting keeps compact comment labels.
     codeLabel = codes.length === 1 ? `[${codes[0] ?? ""}]` : `[${codes.join(", ")}]`;
    if (hatch.directive.startsWith("@ts")) {
      return `${indent}// ${hatch.directive} ${codeLabel} ${hatch.justification}`;
    }
    // oxlint-disable-next-line eslint/one-var -- [EH-126] registry helpers keep related declarations grouped.
    const rulesText = hatch.rules.join(", ");
    if (kind === "block" && hatch.directive.startsWith("oxlint")) {
      // oxlint-disable-next-line eslint/no-ternary, unicorn/prefer-ternary -- [EH-124, EH-234] registry formatting keeps compact comment labels.
      const lineDirective = hatch.directive === "oxlint-disable" ? "oxlint-disable-next-line" : hatch.directive;
      return `${indent}// ${lineDirective} ${rulesText} -- ${codeLabel} ${hatch.justification}`;
    }
    if (kind === "block") {
      return `${indent}/* ${hatch.directive} ${rulesText} -- ${codeLabel} ${hatch.justification} */`;
    }
    return `${indent}// ${hatch.directive} ${rulesText} -- ${codeLabel} ${hatch.justification}`;
  },
  // oxlint-disable-next-line eslint/max-statements, eslint/sort-vars, eslint/max-lines-per-function, effecttsgo/async-function -- [EH-220, EH-225, EH-216, EH-020] escape hatch registry CLI uses async filesystem IO.
  assignCodes = async (
    hatches: readonly EscapeHatch[],
  ): Promise<{
    readonly codeByKey: ReadonlyMap<string, string>;
    readonly entries: readonly {
      readonly code: string;
      readonly justification: string;
      readonly locations: readonly { readonly filePath: string; readonly lineNumber: number }[];
      readonly rule: string;
    }[];
  }> => {
    const keys = new Set<string>();
    for (const hatch of hatches) {
      for (const rule of hatch.rules) {
        keys.add(justificationKey(rule, hatch.justification));
      }
    }
    // oxlint-disable-next-line eslint/one-var -- [EH-126] registry helpers keep related declarations grouped.
    const existingCodeByKey = await loadExistingCodes(),
      // oxlint-disable-next-line unicorn/no-array-sort -- [EH-209] registry keys are sorted in place before code assignment.
      sortedKeys = [...keys].sort((left, right) => {
      const [leftRule, leftJustification] = left.split("\0"),
        [rightRule, rightJustification] = right.split("\0"),
       ruleComparison = (leftRule ?? "").localeCompare(rightRule ?? "");
      if (ruleComparison !== 0) {
        return ruleComparison;
      }
      return (leftJustification ?? "").localeCompare(rightJustification ?? "");
    }),
     // oxlint-disable-next-line eslint/sort-vars -- [EH-132] registry helpers follow parse, assign, and render order.
     codeByKey = new Map<string, string>(existingCodeByKey),
      // oxlint-disable-next-line eslint/sort-vars -- [EH-132] registry helpers follow parse, assign, and render order.
      assignedCodes = new Set(existingCodeByKey.values()),
      entries: {
        code: string;
        justification: string;
        locations: { filePath: string; lineNumber: number }[];
        rule: string;
      }[] = [];
    for (const key of sortedKeys) {
      const [rule = "", justification = ""] = key.split("\0");
      let code = codeByKey.get(key);
      if (code === undefined) {
        code = nextRegistryCode(assignedCodes);
        codeByKey.set(key, code);
        assignedCodes.add(code);
      }
      entries.push({
        code,
        justification,
        locations: [],
        rule,
      });
    }
    for (const hatch of hatches) {
      for (const rule of hatch.rules) {
        const key = justificationKey(rule, hatch.justification),
          // oxlint-disable-next-line eslint/sort-vars -- [EH-132] registry helpers follow parse, assign, and render order.
          code = codeByKey.get(key);
        if (code === undefined) {
          // oxlint-disable-next-line eslint/no-continue -- [EH-121] registry assignment skips unresolved rule and code pairs.
          continue;
        }
        // oxlint-disable-next-line eslint/one-var -- [EH-126] registry helpers keep related declarations grouped.
        const entry = entries.find((candidate) => candidate.code === code);
        if (entry === undefined) {
          // oxlint-disable-next-line eslint/no-continue -- [EH-121] registry assignment skips unresolved rule and code pairs.
          continue;
        }
        // oxlint-disable-next-line eslint/one-var -- [EH-126] registry helpers keep related declarations grouped.
        const relativeFilePath = relativePath(hatch.filePath),
          // oxlint-disable-next-line eslint/sort-vars -- [EH-132] registry helpers follow parse, assign, and render order.
          alreadyRecorded = entry.locations.some(
            (location) =>
              location.filePath === relativeFilePath && location.lineNumber === hatch.lineNumber,
          );
        if (!alreadyRecorded) {
          entry.locations.push({
            filePath: relativeFilePath,
            lineNumber: hatch.lineNumber,
          });
        }
      }
    }
    for (const entry of entries) {
      entry.locations.sort((left, right) => {
        const pathComparison = left.filePath.localeCompare(right.filePath);
        if (pathComparison !== 0) {
          return pathComparison;
        }
        return left.lineNumber - right.lineNumber;
      });
    }
    return { codeByKey, entries };
  },
  // oxlint-disable-next-line eslint/max-statements, eslint/max-lines-per-function, effecttsgo/async-function -- [EH-220, EH-216, EH-020] escape hatch registry CLI uses async filesystem IO.
  updateSourceFiles = async (
    hatches: readonly EscapeHatch[],
    codeByKey: ReadonlyMap<string, string>,
  ): Promise<number> => {
    const hatchesByFile = new Map<string, EscapeHatch[]>();
    for (const hatch of hatches) {
      const existing = hatchesByFile.get(hatch.filePath) ?? [];
      existing.push({ ...hatch });
      hatchesByFile.set(hatch.filePath, existing);
    }
    let updatedLineCount = 0;
    for (const [filePath, fileHatches] of hatchesByFile) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- [EH-120] file scans and updates must preserve source order.
      const content = await Bun.file(filePath).text(),
        lines = content.split("\n");
      for (const hatch of fileHatches) {
        const lineIndex = hatch.lineNumber - 1,
          // oxlint-disable-next-line eslint/sort-vars -- [EH-132] registry helpers follow parse, assign, and render order.
          currentLine = lines[lineIndex] ?? "",
          // oxlint-disable-next-line eslint/sort-vars -- [EH-132] registry helpers follow parse, assign, and render order.
          codes = hatch.rules
            .map((rule) => codeByKey.get(justificationKey(rule, hatch.justification)))
            .filter((code): code is string => code !== undefined),
          formattedLine = formatInlineComment(hatch, codes);
        if (formattedLine !== currentLine) {
          lines[lineIndex] = formattedLine;
          updatedLineCount += 1;
        }
      }
      while (lines.length > 0 && lines.at(-1) === "") {
        lines.pop();
      }
      // oxlint-disable-next-line eslint/one-var, eslint/no-ternary -- [EH-221, EH-124] registry formatting keeps compact comment labels.
      const normalizedContent = lines.length === 0 ? "" : `${lines.join("\n")}\n`;
      if (normalizedContent !== content) {
        // oxlint-disable-next-line eslint/no-await-in-loop -- [EH-120] file scans and updates must preserve source order.
        await Bun.write(filePath, normalizedContent);
      }
    }
    return updatedLineCount;
  },
  // oxlint-disable-next-line effecttsgo/async-function, effecttsgo/missing-pipeable-signature, eslint/sort-vars -- [EH-227, EH-228, EH-231] escape hatch registry helpers are intentionally direct-call only.
  applyRegistryCodes = async (
    hatches: readonly EscapeHatch[],
  ): Promise<{
    readonly codeByKey: ReadonlyMap<string, string>;
    readonly entries: readonly {
      readonly code: string;
      readonly justification: string;
      readonly locations: readonly { readonly filePath: string; readonly lineNumber: number }[];
      readonly rule: string;
    }[];
    readonly updatedLineCount: number;
  }> => {
    const { codeByKey, entries } = await assignCodes(hatches),
      updatedLineCount = await updateSourceFiles(hatches, codeByKey);
    return { codeByKey, entries, updatedLineCount };
  };

export { applyRegistryCodes };
