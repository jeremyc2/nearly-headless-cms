import { FIRST_INDEX, ONE_ITEM } from "./delivery-support.ts";

interface ParsedByteRange {
  readonly end: number;
  readonly start: number;
}

const byteRangePattern = /^bytes=(?<start>\d*)-(?<end>\d*)$/u,
  byteRangeEndFromMatch = (match: RegExpExecArray, byteLength: number): number => {
    if (match.groups?.["start"] === "" || match.groups?.["end"] === "") {
      return byteLength - ONE_ITEM;
    }
    return Number(match.groups?.["end"]);
  },
  byteRangeStartFromMatch = (match: RegExpExecArray, byteLength: number): number => {
    if (match.groups?.["start"] === "") {
      return Math.max(FIRST_INDEX, byteLength - Number(match.groups?.["end"]));
    }
    return Number(match.groups?.["start"]);
  },
  parseByteRange = (
    range: string,
    byteLength: number,
  ): ParsedByteRange | "invalid" | "unsatisfiable" => {
    const match = byteRangePattern.exec(range);
    if (match === null || range.includes(",")) {
      return "invalid";
    }
    const end = byteRangeEndFromMatch(match, byteLength),
      start = byteRangeStartFromMatch(match, byteLength);
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start < FIRST_INDEX ||
      end < start ||
      start >= byteLength
    ) {
      return "unsatisfiable";
    }
    return { end, start };
  };

export default {
  parseByteRange,
};
