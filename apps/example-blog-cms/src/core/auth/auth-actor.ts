/** Cognito group claims carried by validated JWT Actors. */
export const cmsEditorGroup = "cms-editor";
export const headlessReaderGroup = "headless-reader";

export interface BlogCmsActor {
  readonly subject: string;
  readonly groups: readonly string[];
  readonly tokenUse: "access" | "service";
}

export const isBlogCmsActor = (value: unknown): value is BlogCmsActor =>
  typeof value === "object" &&
  value !== null &&
  "subject" in value &&
  "groups" in value &&
  "tokenUse" in value &&
  typeof value.subject === "string" &&
  Array.isArray(value.groups);
