export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { handler, ok, fail, Errors } from "@/lib/api";
import { verifyRefresh } from "@/lib/jwt";
import { REFRESH_COOKIE, setSessionCookies, clearSessionCookies, rotateRefreshToken } from "@/lib/auth";
import { clientIp } from "@/lib/ratelimit";
import { audit } from "@/lib/audit";

/** Refresh tokens are single-use (rotated on every call), not just
 *  long-lived-until-expiry. A refresh token presented after it's already
 *  been rotated can only mean one of two things: a network retry racing
 *  the first rotation, or the token was stolen and the thief and the
 *  legitimate client are now both presenting copies of it. Since this
 *  endpoint can't tell those apart, it treats *any* reuse of an
 *  already-rotated token as a compromise signal and revokes every active
 *  session for that user — logging out the legitimate client too, but
 *  forcing a fresh sign-in is a small cost next to leaving a stolen
 *  session alive. */
export const POST = handler(async (req: Request) => {
  const rt = (await cookies()).get(REFRESH_COOKIE)?.value;
  if (!rt) throw Errors.unauthorized();

  let claims;
  try {
    claims = await verifyRefresh(rt);
  } catch {
    throw Errors.unauthorized("Session expired. Please sign in again.");
  }

  const stored = await prisma.refreshToken.findUnique({ where: { jti: claims.jti } });
  if (!stored) throw Errors.unauthorized("Session expired. Please sign in again.");

  if (stored.revokedAt) {
    await prisma.refreshToken.updateMany({ where: { userId: stored.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await audit({ req, actorId: stored.userId, action: "auth.refresh_reuse_detected", entityType: "user", entityId: stored.userId });
    const res = fail(Errors.unauthorized("Session expired. Please sign in again."));
    clearSessionCookies(res);
    return res;
  }
  if (stored.expiresAt < new Date()) throw Errors.unauthorized("Session expired. Please sign in again.");

  const user = await prisma.user.findUnique({ where: { id: claims.sub } });
  if (!user || !user.isActive) throw Errors.unauthorized("Session expired. Please sign in again.");

  const tokens = await rotateRefreshToken(stored.id, user, { userAgent: req.headers.get("user-agent") ?? "", ip: clientIp(req) });
  const res = ok({ accessToken: tokens.accessToken, expiresIn: tokens.expiresIn });
  setSessionCookies(res, tokens);
  return res;
});
