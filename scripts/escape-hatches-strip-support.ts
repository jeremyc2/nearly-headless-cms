// Removes disabled lint rules that are turned off globally from escape-hatch comments.
import { relativePath } from "./escape-hatches-parse-support.ts";

const repositoryRoot = `${import.meta.dir}/..`,
  obsoleteRules = new Set(["eslint/sort-imports", "eslint/sort-vars"]),
  rulePattern = /^[\w@/-]+$/u,
  parseRulesSegment = (rulesSegment: string): readonly string[] =>
    rulesSegment
      .split(",")
      .map((rule) => rule.trim())
      .filter((rule) => rule.length > 0 && rulePattern.test(rule)),
  stripRulesFromLine = (line: string): string | undefined => {
    const commentMatch =
        /^(?<indent>\s*)\/\/\s*(?<directive>oxlint-disable(?:-next-line)?)\s+(?<rules>.+?)\s+--\s+(?<rest>.+)$/u.exec(
          line,
        ),
      remainingRules =
        commentMatch?.groups === undefined
          ? []
          : parseRulesSegment(commentMatch.groups["rules"] ?? "").filter(
              (rule) => !obsoleteRules.has(rule),
            );
    if (commentMatch?.groups === undefined) {
      return line;
    }
    if (remainingRules.length === 0) {
      return undefined;
    }
    return `${commentMatch.groups["indent"] ?? ""}// ${commentMatch.groups["directive"] ?? ""} ${remainingRules.join(", ")} -- ${commentMatch.groups["rest"] ?? ""}`;
  },
  stripLines = (lines: readonly string[]): { readonly changed: boolean; readonly lines: readonly string[] } => {
    const updatedLines: string[] = [];
    let changed = false;
    for (const line of lines) {
      const updatedLine = stripRulesFromLine(line);
      if (updatedLine === undefined) {
        if (line.trim().length > 0) {
          changed = true;
        }
      } else {
        if (updatedLine !== line) {
          changed = true;
        }
        updatedLines.push(updatedLine);
      }
    }
    while (updatedLines.length > 0 && updatedLines.at(-1) === "") {
      updatedLines.pop();
    }
    return { changed, lines: updatedLines };
  },
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-281] escape hatch maintenance performs repository file scans.
  collectSourceFiles = async (): Promise<readonly string[]> => {
    const glob = new Bun.Glob("**/*.{ts,tsx,cjs,mjs,js,astro}"),
      paths = await Array.fromAsync(glob.scan({ absolute: true, cwd: repositoryRoot }));
    return paths
      .filter(
        (candidate) =>
          !candidate.includes("/node_modules/") &&
          !candidate.includes("/.git/") &&
          !candidate.includes("/dist/"),
      )
      .toSorted();
  },
  // oxlint-disable-next-line effecttsgo/async-function, eslint/no-await-in-loop, eslint/max-statements -- [EH-282, EH-283, EH-291] escape hatch maintenance updates source files sequentially to preserve formatting.
  stripObsoleteRulesFromSources = async (): Promise<number> => {
    let updatedFileCount = 0;
    for (const filePath of await collectSourceFiles()) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- [EH-288] escape hatch maintenance reads source files sequentially to preserve formatting.
      const content = await Bun.file(filePath).text(),
        { changed, lines: updatedLines } = stripLines(content.split("\n"));
      if (changed) {
        let normalizedContent = "";
        if (updatedLines.length > 0) {
          normalizedContent = `${updatedLines.join("\n")}\n`;
        }
        // oxlint-disable-next-line eslint/no-await-in-loop -- [EH-283] escape hatch maintenance updates source files sequentially to preserve formatting.
        await Bun.write(filePath, normalizedContent);
        updatedFileCount += 1;
        // oxlint-disable-next-line effecttsgo/global-console -- [EH-096] escape hatch maintenance CLI reports progress.
        console.log(`Stripped obsolete sort rules from ${relativePath(filePath)}`);
      }
    }
    return updatedFileCount;
  };

export { stripObsoleteRulesFromSources };
