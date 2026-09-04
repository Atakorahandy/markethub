export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { handler, ok } from "@/lib/api";
import { verifyRefresh } from "@/lib/jwt";
import { REFRESH_COOKIE, clearSessionCookies } from "@/lib/auth";

export const POST = handler(async () => {
  const rt = cookies().get(REFRESH_COOKIE)?.value;
  if (rt) {
    try {
      const claims = await verifyRefresh(rt);
      await prisma.refreshToken.updateMany({ where: { jti: claims.jti }, data: { revokedAt: new Date() } });
    } catch {
      /* already invalid */
    }
  }
  const res = ok({ ok: true });
  clearSessionCookies(res);
  return res;
});
