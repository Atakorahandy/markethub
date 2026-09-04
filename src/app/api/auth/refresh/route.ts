export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { handler, ok, Errors } from "@/lib/api";
import { verifyRefresh, signAccess } from "@/lib/jwt";
import { REFRESH_COOKIE, ACCESS_COOKIE } from "@/lib/auth";
import { env } from "@/lib/env";

export const POST = handler(async () => {
  const rt = cookies().get(REFRESH_COOKIE)?.value;
  if (!rt) throw Errors.unauthorized();

  let claims;
  try {
    claims = await verifyRefresh(rt);
  } catch {
    throw Errors.unauthorized("Session expired. Please sign in again.");
  }

  const stored = await prisma.refreshToken.findUnique({ where: { jti: claims.jti } });
  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw Errors.unauthorized("Session expired. Please sign in again.");
  }

  const user = await prisma.user.findUnique({ where: { id: claims.sub } });
  if (!user || !user.isActive) {
    throw Errors.unauthorized("Session expired. Please sign in again.");
  }

  const accessToken = await signAccess({ sub: user.id, email: user.email, kind: user.kind });
  const res = ok({ accessToken, expiresIn: env.accessTtl });
  const secure = env.isProd ? "; Secure" : "";
  res.headers.append(
    "Set-Cookie",
    `${ACCESS_COOKIE}=${accessToken}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=${env.accessTtl}`,
  );
  return res;
});
