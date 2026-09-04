export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseBody, Errors } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { verifyAndSettle } from "@/lib/payments/process";
import { rateLimit, clientIp } from "@/lib/ratelimit";

const schema = z.object({ reference: z.string().min(4).max(120) });

/** Called by the checkout return page. Re-verifies the transaction with the
 *  gateway server-side and settles the order — never trusts the redirect. */
export const POST = handler(async (req: Request) => {
  const s = await requireAuth(req);
  rateLimit(`verify:${s.userId}:${clientIp(req)}`, 30, 300);
  const { reference } = await parseBody(req, schema);

  const payment = await prisma.payment.findUnique({ where: { reference }, include: { order: true } });
  if (!payment || payment.order.customerId !== s.userId) throw Errors.notFound();

  const result = await verifyAndSettle(reference);
  return ok({ status: result.status, orderNumber: payment.order.orderNumber });
});
