import { SignJWT, jwtVerify } from "jose";
import { env } from "./env";

const accessKey = new TextEncoder().encode(env.jwtAccessSecret);
const refreshKey = new TextEncoder().encode(env.jwtRefreshSecret);
const ISS = "markethub";

export type AccessClaims = {
  sub: string; // user id
  email: string;
  kind: string; // customer | vendor | delivery_agent | staff
  typ: "access";
};

export type RefreshClaims = {
  sub: string;
  jti: string;
  typ: "refresh";
};

/** Issued after a correct password but before MFA is satisfied — proves
 *  "this request already passed password verification for this user" for
 *  the few minutes it takes to enter a 6-digit code, nothing more. It is
 *  never set as a cookie and can't be used in place of an access token
 *  (verifyAccess rejects it outright via the `typ` check) — it only ever
 *  travels in a JSON response body and back in a request body. Signed with
 *  the same key as access tokens; the distinct `typ` is what keeps the two
 *  from being interchangeable, the same discriminator that already keeps
 *  access and refresh tokens apart despite sharing this module's pattern. */
export type MfaChallengeClaims = {
  sub: string;
  typ: "mfa_challenge";
};

export async function signAccess(claims: Omit<AccessClaims, "typ">): Promise<string> {
  return new SignJWT({ ...claims, typ: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(ISS)
    .setExpirationTime(`${env.accessTtl}s`)
    .sign(accessKey);
}

export async function signRefresh(claims: Omit<RefreshClaims, "typ">): Promise<string> {
  return new SignJWT({ ...claims, typ: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(ISS)
    .setExpirationTime(`${env.refreshTtl}s`)
    .sign(refreshKey);
}

export async function verifyAccess(token: string): Promise<AccessClaims> {
  const { payload } = await jwtVerify(token, accessKey, { issuer: ISS });
  if (payload.typ !== "access") throw new Error("wrong token type");
  return payload as unknown as AccessClaims;
}

export async function verifyRefresh(token: string): Promise<RefreshClaims> {
  const { payload } = await jwtVerify(token, refreshKey, { issuer: ISS });
  if (payload.typ !== "refresh") throw new Error("wrong token type");
  return payload as unknown as RefreshClaims;
}

export async function signMfaChallenge(sub: string): Promise<string> {
  return new SignJWT({ sub, typ: "mfa_challenge" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(ISS)
    .setExpirationTime("5m")
    .sign(accessKey);
}

export async function verifyMfaChallenge(token: string): Promise<MfaChallengeClaims> {
  const { payload } = await jwtVerify(token, accessKey, { issuer: ISS });
  if (payload.typ !== "mfa_challenge") throw new Error("wrong token type");
  return payload as unknown as MfaChallengeClaims;
}
