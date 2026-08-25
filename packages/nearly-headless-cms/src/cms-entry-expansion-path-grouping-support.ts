import { InvalidInput } from "./cms-error.ts";

interface ParsedExpansionPath {
  readonly remainder: string;
  readonly root: string;
}

const groupExpansionPaths = (paths: readonly string[]): ReadonlyMap<string, readonly string[]> => {
    if (paths.length > maximumExpansionPaths) {
      throw InvalidInput.make({
        message: `Relationship Expansion cannot contain more than ${maximumExpansionPaths} paths`,
      });
    }
    const grouped = new Map<string, string[]>();
    for (const path of paths) {
      const { remainder, root } = parseExpansionPath(path),
        nested = grouped.get(root) ?? [];
      if (remainder.length > 0) {
        nested.push(remainder);
      }
      grouped.set(root, nested);
    }
    return grouped;
  },
  maximumExpansionDepth = 8,
  maximumExpansionPaths = 20,
  parseExpansionPath = (path: string): ParsedExpansionPath => {
    const segments = path.split(".");
    if (segments.some((segment) => segment.length === 0)) {
      throw InvalidInput.make({ message: `Invalid Relationship Expansion path ${path}` });
    }
    if (segments.length > maximumExpansionDepth) {
      throw InvalidInput.make({
        message: `Relationship Expansion cannot exceed ${maximumExpansionDepth} levels`,
      });
    }
    return {
      remainder: segments.slice(1).join("."),
      root: segments[0] ?? "",
    };
  };

export default { groupExpansionPaths };
