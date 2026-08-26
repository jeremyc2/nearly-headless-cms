// Escape hatch parsing and repository scanning helpers.
// oxlint-disable-next-line effecttsgo/node-builtin-import -- [EH-102] Standalone CLI resolves repository paths before any Effect application exists.
import path from "node:path";

export interface EscapeHatch {
  readonly directive: string;
  readonly filePath: string;
  readonly justification: string;
  readonly lineNumber: number;
  readonly originalLine: string;
  readonly rules: readonly string[];
}

const repositoryRoot = path.join(import.meta.dir, ".."),
  // oxlint-disable-next-line eslint/sort-vars -- [EH-132] registry helpers follow parse, assign, and render order.
  escapeHatchesDocumentPath = path.join(repositoryRoot, "ESCAPE_HATCHES.md"),
  justificationSeparatorLength = 4,
  // oxlint-disable-next-line eslint/sort-vars -- [EH-132] registry helpers follow parse, assign, and render order.
  ignoredPathSegments = ["node_modules", ".git", "dist"],
  // oxlint-disable-next-line eslint/sort-vars -- [EH-132] registry helpers follow parse, assign, and render order.
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
    // oxlint-disable-next-line eslint/require-unicode-regexp -- [EH-127] registry parsing uses ASCII comment markers only.
    return previousLine.replace(/^\/\/\s*/, "").trim();
  },
  stripExistingCode = (text: string): string =>
    // oxlint-disable-next-line eslint/require-unicode-regexp -- [EH-127] registry parsing uses ASCII comment markers only.
    text.replaceAll(/\[EH-\d{3}(?:,\s*EH-\d{3})*\]\s*/g, "").trim(),
  // oxlint-disable-next-line eslint/sort-vars -- [EH-132] registry helpers follow parse, assign, and render order.
  normalizeJustification = (rawJustification: string): string =>
    // oxlint-disable-next-line eslint/require-unicode-regexp -- [EH-127] registry parsing uses ASCII comment markers only.
    stripExistingCode(rawJustification).replaceAll(/\s+/g, " "),
  relativePath = (absolutePath: string): string => path.relative(repositoryRoot, absolutePath),
  shouldIgnorePath = (absolutePath: string): boolean => {
    const relative = relativePath(absolutePath);
    if (relative === "ESCAPE_HATCHES.md" || relative === "scripts/escape-hatches.ts") {
      return true;
    }
    return ignoredPathSegments.some(
      (segment) => relative.startsWith(`${segment}/`) || relative.includes(`/${segment}/`),
    );
  },
  // oxlint-disable-next-line eslint/sort-vars, effecttsgo/async-function -- [EH-225, EH-020] escape hatch registry CLI uses async filesystem IO.
  collectSourceFiles = async (): Promise<string[]> => {
    const glob = new Bun.Glob("**/*.{ts,tsx,cjs,mjs,js}"),
      paths = await Array.fromAsync(glob.scan({ absolute: true, cwd: repositoryRoot }));
    // oxlint-disable-next-line unicorn/no-array-sort -- [EH-209] registry keys are sorted in place before code assignment.
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
    // oxlint-disable-next-line eslint/require-unicode-regexp -- [EH-127] registry parsing uses ASCII comment markers only.
    const lineMatch = /^(?<indent>\s*)\/\/\s*(?<content>.+)$/.exec(line);
    if (lineMatch?.groups !== undefined) {
      return {
        content: lineMatch.groups["content"] ?? "",
        indent: lineMatch.groups["indent"] ?? "",
        kind: "line",
      };
    }
    // oxlint-disable-next-line eslint/one-var, eslint/require-unicode-regexp -- [EH-223, EH-127] registry parsing uses ASCII comment markers only.
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
  // oxlint-disable-next-line eslint/max-statements, eslint/max-lines-per-function, eslint/max-params -- [EH-219, EH-118, EH-218] escape hatch parsing and rendering are intentionally colocated.
  parseEscapeHatch = (
    filePath: string,
    lineNumber: number,
    line: string,
    lines: readonly string[],
  ): EscapeHatch | undefined => {
    const comment = parseCommentContent(line);
    if (comment === undefined) {
      return undefined;
    }
    // oxlint-disable-next-line eslint/one-var, eslint/require-unicode-regexp -- [EH-223, EH-127] registry parsing uses ASCII comment markers only.
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
    // oxlint-disable-next-line eslint/one-var -- [EH-126] registry helpers keep related declarations grouped.
    const oxlintDirectiveMatch =
      // oxlint-disable-next-line eslint/require-unicode-regexp -- [EH-127] registry parsing uses ASCII comment markers only.
      /^(?<directive>oxlint-disable(?:-next-line)?)\s+(?<remainder>.+)$/.exec(comment.content);
    if (oxlintDirectiveMatch?.groups === undefined) {
      return undefined;
    }
    // oxlint-disable-next-line eslint/one-var, eslint/sort-vars -- [EH-126, EH-233] registry helpers keep related declarations grouped.
    const directive = oxlintDirectiveMatch.groups["directive"] ?? "",
      remainder = oxlintDirectiveMatch.groups["remainder"] ?? "",
      separatorIndex = remainder.indexOf(" -- "),
    // oxlint-disable-next-line eslint/no-ternary, eslint/sort-vars -- [EH-230, EH-233] registry helpers keep related declarations grouped.
     rulesText = separatorIndex === -1 ? remainder.trim() : remainder.slice(0, separatorIndex).trim();
    // oxlint-disable-next-line eslint/no-ternary, eslint/one-var -- [EH-230, EH-126] registry helpers keep related declarations grouped.
    const rawJustification = separatorIndex === -1 ? "" : remainder.slice(separatorIndex + justificationSeparatorLength).trim();
    let justification = normalizeJustification(rawJustification);
    // oxlint-disable-next-line eslint/one-var -- [EH-126] registry helpers keep related declarations grouped.
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
      // oxlint-disable-next-line unicorn/prefer-ternary -- [EH-215] registry defaults keep explicit branch justifications.
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
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-020] escape hatch registry CLI uses async filesystem IO.
  scanEscapeHatches = async (): Promise<readonly EscapeHatch[]> => {
    const files = await collectSourceFiles(),
      hatches: EscapeHatch[] = [];
    for (const filePath of files) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- [EH-120] file scans and updates must preserve source order.
      const content = await Bun.file(filePath).text(),
        lines = content.split("\n");
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
        const line = lines[lineIndex] ?? "",
          // oxlint-disable-next-line eslint/sort-vars -- [EH-132] registry helpers follow parse, assign, and render order.
          hatch = parseEscapeHatch(filePath, lineIndex + 1, line, lines);
        if (hatch !== undefined) {
          hatches.push(hatch);
        }
      }
    }
    return hatches;
  };

export { escapeHatchesDocumentPath, parseCommentContent, relativePath, scanEscapeHatches };
