// Escape hatch registry CLI orchestration for scan, sync, reindex, and render workflows.
import { escapeHatchesDocumentPath, relativePath, scanEscapeHatches } from "./escape-hatches-parse-support.ts";
import { applyRegistryCodes } from "./escape-hatches-registry-support.ts";
import { renderEscapeHatchesDocument } from "./escape-hatches-render-support.ts";
import { stripObsoleteRulesFromSources } from "./escape-hatches-strip-support.ts";

const
  // oxlint-disable-next-line eslint/max-statements, effecttsgo/async-function -- [EH-174, EH-026] escape hatch registry CLI uses async filesystem IO.
  verifyEscapeHatches = async (): Promise<number> => {
    const hatches = await scanEscapeHatches();
    let missingCodeCount = 0;
    for (const hatch of hatches) {
      if (hatch.directive === "oxlint-disable") {
        // oxlint-disable-next-line effecttsgo/global-console -- [EH-097] escape hatch registry CLI reports to stdout and stderr.
        console.error(
          `File-wide oxlint disable forbidden at ${relativePath(hatch.filePath)}:${String(hatch.lineNumber)}`,
        );
        missingCodeCount += 1;
      }
      // oxlint-disable-next-line eslint/require-unicode-regexp -- [EH-195] registry parsing uses ASCII comment markers only.
      if (!/\[EH-\d{3}(?:,\s*EH-\d{3})*\]/.test(hatch.originalLine)) {
        // oxlint-disable-next-line effecttsgo/global-console -- [EH-097] escape hatch registry CLI reports to stdout and stderr.
        console.error(`Missing escape-hatch code at ${relativePath(hatch.filePath)}:${hatch.lineNumber}`);
        missingCodeCount += 1;
      }
    }
    // oxlint-disable-next-line eslint/one-var -- [EH-192] registry helpers keep related declarations grouped.
    const document = await Bun.file(escapeHatchesDocumentPath).text();
    if (document.length === 0) {
      // oxlint-disable-next-line effecttsgo/global-console -- [EH-097] escape hatch registry CLI reports to stdout and stderr.
      console.error("ESCAPE_HATCHES.md is missing.");
      missingCodeCount += 1;
    }
    return missingCodeCount;
  },
  // oxlint-disable-next-line effecttsgo/async-function, eslint/max-statements -- [EH-286, EH-287] escape hatch registry CLI keeps command dispatch in one entrypoint.
  main = async (): Promise<void> => {
    const command = process.argv[2] ?? "sync";
    if (command === "verify") {
      const missingCodeCount = await verifyEscapeHatches();
      if (missingCodeCount > 0) {
        process.exitCode = 1;
      }
      return;
    }
    if (command === "reindex") {
      const strippedFileCount = await stripObsoleteRulesFromSources(),
       hatches = await scanEscapeHatches(),
        { entries, updatedLineCount } = await applyRegistryCodes(hatches, { reindex: true }),
        document = renderEscapeHatchesDocument(entries);
      await Bun.write(escapeHatchesDocumentPath, document);
      // oxlint-disable-next-line effecttsgo/global-console -- [EH-097] escape hatch registry CLI reports to stdout and stderr.
      console.log(
        `Reindexed ${String(hatches.length)} escape hatch(es) across ${String(entries.length)} code(s); stripped obsolete rules from ${String(strippedFileCount)} file(s); updated ${String(updatedLineCount)} line(s).`,
      );
      return;
    }
    // oxlint-disable-next-line eslint/one-var -- [EH-192] registry helpers keep related declarations grouped.
    const hatches = await scanEscapeHatches(),
      { entries, updatedLineCount } = await applyRegistryCodes(hatches),
      document = renderEscapeHatchesDocument(entries);
    await Bun.write(escapeHatchesDocumentPath, document);
    // oxlint-disable-next-line effecttsgo/global-console -- [EH-097] escape hatch registry CLI reports to stdout and stderr.
    console.log(
      `Synced ${String(hatches.length)} escape hatch(es) across ${String(entries.length)} code(s); updated ${String(updatedLineCount)} line(s).`,
    );
  };

export { main };
