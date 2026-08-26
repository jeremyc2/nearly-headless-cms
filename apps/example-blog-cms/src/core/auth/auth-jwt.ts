import { Identity } from "nearly-headless-cms";
import { SignJWT, jwtVerify } from "jose";
import {
  type BlogCmsActor,
  cmsEditorGroup,
  headlessReaderGroup,
  isBlogCmsActor,
} from "./auth-actor.ts";

const defaultJwtSecret = "example-blog-cms-development-secret-change-me",
  jwtIssuer = "example-blog-cms",
  jwtAudience = "nearly-headless-cms",
  bearerPrefix = "Bearer ",
  emptyBearerLength = 0;

const resolveJwtSecret = (): Uint8Array =>
  new TextEncoder().encode(Bun.env["EXAMPLE_BLOG_CMS_JWT_SECRET"] ?? defaultJwtSecret);

export const actorFromValidatedClaims = (claims: {
  readonly sub?: unknown;
  readonly groups?: unknown;
  readonly token_use?: unknown;
}): BlogCmsActor => ({
  groups: Array.isArray(claims.groups)
    ? claims.groups.filter((group): group is string => typeof group === "string")
    : [],
  subject: typeof claims.sub === "string" ? claims.sub : "unknown-subject",
  tokenUse: claims.token_use === "service" ? "service" : "access",
});

/** Validates a Bearer JWT. In production, swap HS256 for Cognito JWKS verification. */
// oxlint-disable-next-line effecttsgo/async-function -- [EH-318] JWT verification uses the jose promise API at the HTTP transport boundary.
export const validateBearerToken = async (
  authorizationHeader: string | null,
): Promise<Identity.Identity<BlogCmsActor>> => {
  if (
    authorizationHeader === null ||
    !authorizationHeader.startsWith(bearerPrefix) ||
    authorizationHeader.length <= bearerPrefix.length + emptyBearerLength
  ) {
    return Identity.anonymous;
  }
  const token = authorizationHeader.slice(bearerPrefix.length);
  try {
    const verified = await jwtVerify(token, resolveJwtSecret(), {
      audience: jwtAudience,
      issuer: jwtIssuer,
    });
    return {
      actor: actorFromValidatedClaims(verified.payload),
      state: "actor",
    };
  } catch {
    return Identity.anonymous;
  }
};

/** Issues a development JWT mimicking Cognito group claims. */
export const issueDevelopmentToken = (input: {
  readonly subject: string;
  readonly groups: readonly string[];
  readonly tokenUse?: BlogCmsActor["tokenUse"];
  readonly expiresInSeconds?: number;
}): Promise<string> => {
  const tokenBuilder = new SignJWT({
      groups: [...input.groups],
      token_use: input.tokenUse ?? "access",
    })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(jwtIssuer)
    .setAudience(jwtAudience)
    .setSubject(input.subject)
    .setIssuedAt();
  if (input.expiresInSeconds !== undefined) {
    tokenBuilder.setExpirationTime(`${input.expiresInSeconds}s`);
  }
  return tokenBuilder.sign(resolveJwtSecret());
};

export const defaultEditorDevelopmentToken = (): Promise<string> =>
  issueDevelopmentToken({
    groups: [cmsEditorGroup],
    subject: "dev-editor@example.com",
  });

export const defaultHeadlessServiceToken = (): Promise<string> =>
  issueDevelopmentToken({
    groups: [headlessReaderGroup],
    subject: "example-blog-build-service",
    tokenUse: "service",
  });

export const isBlogCmsIdentity = (
  identity: Identity.Identity,
): identity is Identity.Actor<BlogCmsActor> =>
  identity.state === "actor" && isBlogCmsActor(identity.actor);

export { cmsEditorGroup, headlessReaderGroup };
