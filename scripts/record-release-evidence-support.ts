const readArchiveChecksum = (report: unknown): string | undefined => {
  if (
    typeof report === "object" &&
    report !== null &&
    "sha256" in report &&
    typeof report.sha256 === "string"
  ) {
    return report.sha256;
  }
  return undefined;
};

export { readArchiveChecksum };
