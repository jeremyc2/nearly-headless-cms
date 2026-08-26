export interface PackageManifest {
  readonly version: string;
}

// oxlint-disable-next-line effecttsgo/async-function -- [EH-012] CLI bootstrap reads package.json before any Effect program exists.
export const readPackageManifest = async (manifestPath: string): Promise<PackageManifest> => {
  const value: unknown = await Bun.file(manifestPath).json();
  if (
    typeof value !== "object" ||
    value === null ||
    !("version" in value) ||
    typeof value.version !== "string"
  ) {
    throw new Error(`Invalid package manifest at ${manifestPath}`);
  }
  return { version: value.version };
};
