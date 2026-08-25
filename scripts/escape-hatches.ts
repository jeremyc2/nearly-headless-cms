// Standalone Bun CLI maintains ESCAPE_HATCHES.md and inline escape-hatch codes.
/* oxlint-disable effecttsgo/async-function -- [EH-020] escape hatch registry CLI uses async filesystem IO. */
/* oxlint-disable effecttsgo/global-console -- [EH-077] escape hatch registry CLI reports to stdout and stderr. */
/* oxlint-disable eslint/max-lines -- [EH-114] escape hatch registry coordinates scan, sync, and render. */
/* oxlint-disable eslint/max-statements -- [EH-119] escape hatch registry coordinates sequential file updates. */
/* oxlint-disable eslint/no-await-in-loop -- [EH-120] file scans and updates must preserve source order. */
/* oxlint-disable eslint/no-magic-numbers -- [EH-122] registry codes use fixed-width numeric padding. */
/* oxlint-disable eslint/max-lines-per-function -- [EH-118] escape hatch parsing and rendering are intentionally colocated. */
/* oxlint-disable eslint/no-continue -- [EH-121] registry assignment skips unresolved rule and code pairs. */
/* oxlint-disable eslint/no-ternary -- [EH-124] registry formatting keeps compact comment labels. */
/* oxlint-disable eslint/one-var -- [EH-126] registry helpers keep related declarations grouped. */
/* oxlint-disable eslint/require-unicode-regexp -- [EH-127] registry parsing uses ASCII comment markers only. */
/* oxlint-disable eslint/sort-vars -- [EH-132] registry helpers follow parse, assign, and render order. */
/* oxlint-disable unicorn/no-array-sort -- [EH-209] registry keys are sorted in place before code assignment. */
/* oxlint-disable eslint/max-params -- [EH-213] escape hatch parsing bundles file, line, and context inputs. */
/* oxlint-disable unicorn/prefer-number-coercion -- [EH-214] registry code numbers are parsed from fixed-width labels. */
/* oxlint-disable unicorn/prefer-ternary -- [EH-215] registry defaults keep explicit branch justifications. */
// oxlint-disable-next-line effecttsgo/node-builtin-import -- [EH-102] Standalone CLI resolves repository paths before any Effect application exists.
import path from "node:path";

const repositoryRoot = path.join(import.meta.dir, ".."),
  escapeHatchesDocumentPath = path.join(repositoryRoot, "ESCAPE_HATCHES.md"),
  justificationSeparatorLength = 4,
  registryCodeWidth = 3,
  ignoredPathSegments = ["node_modules", ".git", "dist"],
  defaultJustifications: Readonly<Record<string, string>> = {},
  readPrecedingJustification = (lines: readonly string[], lineIndex: number): string | undefined => {
    if (lineIndex === 0) {
      return undefined;
    }
    const previousLine = lines[lineIndex - 1]?.trim() ?? "";
    if (!previousLine.startsWith("//")) {
      return undefined;
    }
    if (previousLine.includes("oxlint-disable") || previousLine.includes("@ts-")) {
      return undefined;
    }
    return previousLine.replace(/^\/\/\s*/, "").trim();
  },
  stripExistingCode = (text: string): string =>
    text.replaceAll(/\[EH-\d{3}(?:,\s*EH-\d{3})*\]\s*/g, "").trim(),
  normalizeJustification = (rawJustification: string): string =>
    stripExistingCode(rawJustification).replaceAll(/\s+/g, " "),
  relativePath = (absolutePath: string): string => path.relative(repositoryRoot, absolutePath),
  shouldIgnorePath = (absolutePath: string): boolean => {
    const relative = relativePath(absolutePath);
    if (relative === "ESCAPE_HATCHES.md" || relative === "scripts/escape-hatches.ts") {
      return false;
    }
    return ignoredPathSegments.some(
      (segment) => relative.startsWith(`${segment}/`) || relative.includes(`/${segment}/`),
    );
  },
  collectSourceFiles = async (): Promise<string[]> => {
    const glob = new Bun.Glob("**/*.{ts,tsx,cjs,mjs,js}"),
      paths = await Array.fromAsync(glob.scan({ absolute: true, cwd: repositoryRoot }));
    return paths.filter((candidate) => ! shouldIgnorePath(candidate)).sort();
  },
  parseCommentContent = (
    line: string,
  ):
    | {
        readonly content: string;
        readonly indent: string;
        readonly kind: "block" | "line";
      }
    | undefined => {
    const lineMatch = /^(?<indent>\s*)\/\/\s*(?<content>.+)$/.exec(line);
    if (lineMatch?.groups !== undefined) {
      return {
        content: lineMatch.groups["content"] ?? "",
        indent: lineMatch.groups["indent"] ?? "",
        kind: "line",
      };
    }
    const blockMatch = /^(?<indent>\s*)\/\*\s*(?<content>.+)\s*\*\/\s*$/.exec(line);
    if (blockMatch?.groups !== undefined) {
      return {
        content: blockMatch.groups["content"] ?? "",
        indent: blockMatch.groups["indent"] ?? "",
        kind: "block",
      };
    }
    return undefined;
  },
  parseEscapeHatch = (
    filePath: string,
    lineNumber: number,
    line: string,
    lines: readonly string[],
  ):
    | {
        readonly directive: string;
        readonly filePath: string;
        readonly justification: string;
        readonly lineNumber: number;
        readonly originalLine: string;
        readonly rules: readonly string[];
      }
    | undefined => {
    const comment = parseCommentContent(line);
    if (comment === undefined) {
      return undefined;
    }
    const tsDirectiveMatch = /^(?<directive>@ts-expect-error|@ts-ignore)\s*(?<justification>.*)$/.exec(
      comment.content,
    );
    if (tsDirectiveMatch?.groups !== undefined) {
      let justification = normalizeJustification(tsDirectiveMatch.groups["justification"] ?? "");
      if (justification.length === 0) {
        justification = "Type-check escape hatch.";
      }
      return {
        directive: tsDirectiveMatch.groups["directive"] ?? "@ts-expect-error",
        filePath,
        justification,
        lineNumber,
        originalLine: line,
        rules: [tsDirectiveMatch.groups["directive"] ?? "@ts-expect-error"],
      };
    }
    const oxlintDirectiveMatch =
      /^(?<directive>oxlint-disable(?:-next-line)?)\s+(?<remainder>.+)$/.exec(comment.content);
    if (oxlintDirectiveMatch?.groups === undefined) {
      return undefined;
    }
    const directive = oxlintDirectiveMatch.groups["directive"] ?? "",
      remainder = oxlintDirectiveMatch.groups["remainder"] ?? "",
      separatorIndex = remainder.indexOf(" -- "),
      rulesText =
        separatorIndex === -1 ? remainder.trim() : remainder.slice(0, separatorIndex).trim(),
      rawJustification = separatorIndex === -1 ? "" : remainder.slice(separatorIndex + justificationSeparatorLength).trim();
    let justification = normalizeJustification(rawJustification);
    const rules = rulesText
      .split(",")
      .map((rule) => rule.trim())
      .filter((rule) => rule.length > 0);
    if (rules.length === 0) {
      return undefined;
    }
    if (justification.length === 0) {
      const precedingJustification = readPrecedingJustification(lines, lineNumber - 1);
      if (precedingJustification !== undefined && precedingJustification.length > 0) {
        justification = precedingJustification;
      }
    }
    if (justification.length === 0) {
      const firstRule = rules[0] ?? "";
      if (
        firstRule === "effecttsgo/node-builtin-import" &&
        relativePath(filePath).startsWith("scripts/")
      ) {
        justification = "Standalone CLI resolves repository paths before any Effect application exists.";
      } else {
        justification = defaultJustifications[firstRule] ?? `Escape hatch for ${firstRule}.`;
      }
    }
    return {
      directive,
      filePath,
      justification,
      lineNumber,
      originalLine: line,
      rules,
    };
  },
  scanEscapeHatches = async (): Promise<
    readonly {
      readonly directive: string;
      readonly filePath: string;
      readonly justification: string;
      readonly lineNumber: number;
      readonly originalLine: string;
      readonly rules: readonly string[];
    }[]
  > => {
    const files = await collectSourceFiles(),
      hatches: {
        directive: string;
        filePath: string;
        justification: string;
        lineNumber: number;
        originalLine: string;
        rules: readonly string[];
      }[] = [];
    for (const filePath of files) {
      const content = await Bun.file(filePath).text(),
        lines = content.split("\n");
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
        const line = lines[lineIndex] ?? "",
          hatch = parseEscapeHatch(filePath, lineIndex + 1, line, lines);
        if (hatch !== undefined) {
          hatches.push(hatch);
        }
      }
    }
    return hatches;
  },
  justificationKey = (rule: string, justification: string): string => `${rule}\0${justification}`,
  loadExistingCodes = async (): Promise<ReadonlyMap<string, string>> => {
    const documentFile = Bun.file(escapeHatchesDocumentPath);
    if (!(await documentFile.exists())) {
      return new Map();
    }
    const document = await documentFile.text(),
      codeByKey = new Map<string, string>(),
      indexLinePattern =
        /^- \*\*(?<code>EH-\d{3})\*\* \(`(?<rule>[^`]+)`\): (?<justification>.+)$/u;
    for (const line of document.split("\n")) {
      const match = indexLinePattern.exec(line);
      if (match?.groups === undefined) {
        continue;
      }
      const rule = match.groups["rule"] ?? "",
        justification = match.groups["justification"] ?? "",
        code = match.groups["code"] ?? "";
      codeByKey.set(justificationKey(rule, justification), code);
    }
    return codeByKey;
  },
  nextRegistryCode = (assignedCodes: ReadonlySet<string>): string => {
    let maximumCodeNumber = 0;
    for (const code of assignedCodes) {
      const codeNumber = Number.parseInt(code.replace("EH-", ""), 10);
      if (!Number.isNaN(codeNumber) && codeNumber > maximumCodeNumber) {
        maximumCodeNumber = codeNumber;
      }
    }
    return `EH-${String(maximumCodeNumber + 1).padStart(registryCodeWidth, "0")}`;
  },
  assignCodes = async (
    hatches: readonly {
      readonly directive: string;
      readonly filePath: string;
      readonly justification: string;
      readonly lineNumber: number;
      readonly originalLine: string;
      readonly rules: readonly string[];
    }[],
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
    const existingCodeByKey = await loadExistingCodes(),
      sortedKeys = [...keys].sort((left, right) => {
      const [leftRule, leftJustification] = left.split("\0"),
        [rightRule, rightJustification] = right.split("\0"),
       ruleComparison = (leftRule ?? "").localeCompare(rightRule ?? "");
      if (ruleComparison !== 0) {
        return ruleComparison;
      }
      return (leftJustification ?? "").localeCompare(rightJustification ?? "");
    }),
     codeByKey = new Map<string, string>(existingCodeByKey),
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
          code = codeByKey.get(key);
        if (code === undefined) {
          continue;
        }
        const entry = entries.find((candidate) => candidate.code === code);
        if (entry === undefined) {
          continue;
        }
        const relativeFilePath = relativePath(hatch.filePath),
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
  formatInlineComment = (
    hatch: {
      readonly directive: string;
      readonly justification: string;
      readonly originalLine: string;
      readonly rules: readonly string[];
    },
    codes: readonly string[],
  ): string => {
    const comment = parseCommentContent(hatch.originalLine),
      indent = comment?.indent ?? "",
      kind = comment?.kind ?? "line",
      codeLabel = codes.length === 1 ? `[${codes[0] ?? ""}]` : `[${codes.join(", ")}]`;
    if (hatch.directive.startsWith("@ts")) {
      return `${indent}// ${hatch.directive} ${codeLabel} ${hatch.justification}`;
    }
    const rulesText = hatch.rules.join(", ");
    if (kind === "block") {
      return `${indent}/* ${hatch.directive} ${rulesText} -- ${codeLabel} ${hatch.justification} */`;
    }
    return `${indent}// ${hatch.directive} ${rulesText} -- ${codeLabel} ${hatch.justification}`;
  },
  updateSourceFiles = async (
    hatches: readonly {
      readonly directive: string;
      readonly filePath: string;
      readonly justification: string;
      readonly lineNumber: number;
      readonly originalLine: string;
      readonly rules: readonly string[];
    }[],
    codeByKey: ReadonlyMap<string, string>,
  ): Promise<number> => {
    const hatchesByFile = new Map<
      string,
      {
        directive: string;
        filePath: string;
        justification: string;
        lineNumber: number;
        originalLine: string;
        rules: readonly string[];
      }[]
    >();
    for (const hatch of hatches) {
      const existing = hatchesByFile.get(hatch.filePath) ?? [];
      existing.push({ ...hatch });
      hatchesByFile.set(hatch.filePath, existing);
    }
    let updatedLineCount = 0;
    for (const [filePath, fileHatches] of hatchesByFile) {
      const content = await Bun.file(filePath).text(),
        lines = content.split("\n");
      for (const hatch of fileHatches) {
        const lineIndex = hatch.lineNumber - 1,
          currentLine = lines[lineIndex] ?? "",
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
      const normalizedContent = lines.length === 0 ? "" : `${lines.join("\n")}\n`;
      if (normalizedContent !== content) {
        await Bun.write(filePath, normalizedContent);
      }
    }
    return updatedLineCount;
  },
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
      "2. Use `// oxlint-disable-next-line` for a single line; avoid file-wide `// oxlint-disable`.",
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
     entriesByRule = new Map<string, (typeof entries)[number][]>();
    for (const entry of entries) {
      const existing = entriesByRule.get(entry.rule) ?? [];
      existing.push(entry);
      entriesByRule.set(entry.rule, existing);
    }
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
  verifyEscapeHatches = async (): Promise<number> => {
    const hatches = await scanEscapeHatches();
    let missingCodeCount = 0;
    for (const hatch of hatches) {
      if (!/\[EH-\d{3}(?:,\s*EH-\d{3})*\]/.test(hatch.originalLine)) {
        console.error(`Missing escape-hatch code at ${relativePath(hatch.filePath)}:${hatch.lineNumber}`);
        missingCodeCount += 1;
      }
    }
    const document = await Bun.file(escapeHatchesDocumentPath).text();
    if (document.length === 0) {
      console.error("ESCAPE_HATCHES.md is missing.");
      missingCodeCount += 1;
    }
    return missingCodeCount;
  },
  main = async (): Promise<void> => {
    const command = process.argv[2] ?? "sync";
    if (command === "verify") {
      const missingCodeCount = await verifyEscapeHatches();
      if (missingCodeCount > 0) {
        process.exitCode = 1;
      }
      return;
    }
    const hatches = await scanEscapeHatches(),
      { codeByKey, entries } = await assignCodes(hatches),
      updatedLineCount = await updateSourceFiles(hatches, codeByKey),
      document = renderEscapeHatchesDocument(entries);
    await Bun.write(escapeHatchesDocumentPath, document);
    console.log(
      `Synced ${String(hatches.length)} escape hatch(es) across ${String(entries.length)} code(s); updated ${String(updatedLineCount)} line(s).`,
    );
  };

await main();
