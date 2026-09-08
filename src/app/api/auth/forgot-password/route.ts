export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseBody, Errors } from "@/lib/api";
import { emailSchema } from "@/lib/validation";
import { randomToken, sha256 } from "@/lib/crypto";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { audit } from "@/lib/audit";
import { verifyCaptcha } from "@/lib/captcha";

const schema = z.object({ email: emailSchema, captchaToken: z.string().nullable().optional() });

export const POST = handler(async (req: Request) => {
  const ip = clientIp(req);
  rateLimit(`forgot:${ip}`, 10, 3600);
  const body = await parseBody(req, schema);
  if (!(await verifyCaptcha(body.captchaToken, ip))) throw Errors.validation({ captchaToken: "failed" }, "CAPTCHA verification failed. Please try again.");

  const user = await prisma.user.findUnique({ where: { email: body.email } });
  // Always respond the same way — never reveal whether the email exists.
  if (user) {
    const token = randomToken();
    await prisma.passwordReset.create({
      data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    });
    await audit({ req, actorId: user.id, action: "auth.password_reset_requested", entityType: "user", entityId: user.id });
    // Phase 8 wires this into the real email channel. For now the token is
    // logged server-side only so the flow is testable in development.
    console.log(`[password-reset] token for ${user.email}: ${token}`);
  }

  return ok({ ok: true, message: "If that email exists, a reset link has been sent." });
});
