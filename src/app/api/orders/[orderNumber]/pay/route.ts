export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseBody, Errors } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { initiatePaymentForOrder } from "@/lib/payments/process";
import { PAYMENT_METHODS } from "@/lib/constants";

const schema = z.object({
  paymentMethod: z.enum(PAYMENT_METHODS.map((m) => m.key) as [string, ...string[]]),
  momoNetwork: z.enum(["mtn", "telecel", "airteltigo"]).optional(),
});

/** (Re)opens payment for an order that's still unpaid — e.g. the customer
 *  abandoned the gateway page the first time and came back to retry. */
export const POST = handler(async (req: Request, { params }: { params: { orderNumber: string } }) => {
  const s = await requireAuth(req);
  const body = await parseBody(req, schema);

  const order = await prisma.order.findUnique({ where: { orderNumber: params.orderNumber } });
  if (!order || order.customerId !== s.userId) throw Errors.notFound();

  const payment = await initiatePaymentForOrder(order.id, { method: body.paymentMethod, momoNetwork: body.momoNetwork, email: s.email });
  return ok(payment);
});
