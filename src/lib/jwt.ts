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
