export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseBody, Errors } from "@/lib/api";
import { requireAuth, can } from "@/lib/auth";
import { orderNumber } from "@/lib/ids";
import { audit } from "@/lib/audit";
import { initiatePaymentForOrder } from "@/lib/payments/process";
import { PAYMENT_METHODS } from "@/lib/constants";

const schema = z.object({
  addressId: z.string().cuid(),
  clientRequestId: z.string().uuid(),
  paymentMethod: z.enum(PAYMENT_METHODS.map((m) => m.key) as [string, ...string[]]),
  momoNetwork: z.enum(["mtn", "telecel", "airteltigo"]).optional(),
});

export const POST = handler(async (req: Request) => {
  const s = await requireAuth(req);
  if (!can(s, "orders.create")) throw Errors.forbidden();
  const body = await parseBody(req, schema);

  // Idempotency: a retried submit (double-click, network retry) returns the
  // order already created for this key instead of erroring or duplicating it.
  const existing = await prisma.order.findUnique({ where: { clientRequestId: body.clientRequestId } });
  if (existing) {
    const payment = await prisma.payment.findUnique({ where: { orderId: existing.id } });
    return ok({ ...existing, payment: payment ? { reference: payment.reference, authorizationUrl: payment.authorizationUrl } : null }, 200);
  }

  const address = await prisma.address.findUnique({ where: { id: body.addressId } });
  if (!address || address.userId !== s.userId) throw Errors.validation({ addressId: "Select a valid delivery address." });

  const cartItems = await prisma.cartItem.findMany({ where: { userId: s.userId } });
  if (cartItems.length === 0) throw Errors.validation({ cart: "Your cart is empty." });

  const order = await prisma.$transaction(async (tx) => {
    type Line = { vendorId: string; vendorName: string; deliveryFee: number; productId: string; variantId: string | null; name: string; image: string; unitPrice: number; quantity: number };
    const lines: Line[] = [];

    for (const item of cartItems) {
      const product = await tx.product.findUnique({
        where: { id: item.productId },
        include: { vendor: { select: { id: true, businessName: true, status: true, baseDeliveryFee: true } } },
      });
      if (!product || product.status !== "active" || product.vendor.status !== "approved") {
        throw Errors.conflict(`An item in your cart is no longer available. Please review your cart.`);
      }

      if (item.variantId) {
        const variant = await tx.productVariant.findUnique({ where: { id: item.variantId } });
        if (!variant || variant.productId !== product.id) throw Errors.conflict("An item in your cart is no longer available.");
        const updated = await tx.productVariant.updateMany({
          where: { id: item.variantId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (updated.count !== 1) throw Errors.conflict(`Not enough stock for "${product.name}" (${variant.label}).`);
        lines.push({
          vendorId: product.vendor.id, vendorName: product.vendor.businessName, deliveryFee: product.vendor.baseDeliveryFee,
          productId: product.id, variantId: variant.id, name: `${product.name} (${variant.label})`,
          image: JSON.parse(product.images || "[]")[0] ?? "", unitPrice: variant.priceOverride ?? product.discountPrice ?? product.price,
          quantity: item.quantity,
        });
      } else {
        const updated = await tx.product.updateMany({
          where: { id: product.id, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (updated.count !== 1) throw Errors.conflict(`Not enough stock for "${product.name}".`);
        lines.push({
          vendorId: product.vendor.id, vendorName: product.vendor.businessName, deliveryFee: product.vendor.baseDeliveryFee,
          productId: product.id, variantId: null, name: product.name,
          image: JSON.parse(product.images || "[]")[0] ?? "", unitPrice: product.discountPrice ?? product.price,
          quantity: item.quantity,
        });
      }
    }

    const vendorIds = [...new Set(lines.map((l) => l.vendorId))];
    const vendorSubtotal = (vendorId: string) => lines.filter((l) => l.vendorId === vendorId).reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
    const vendorFee = (vendorId: string) => lines.find((l) => l.vendorId === vendorId)!.deliveryFee;

    const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
    const deliveryFee = vendorIds.reduce((sum, id) => sum + vendorFee(id), 0);

    const created = await tx.order.create({
      data: {
        orderNumber: orderNumber(),
        customerId: s.userId,
        addressId: address.id,
        clientRequestId: body.clientRequestId,
        recipientName: address.recipientName, phone: address.phone, region: address.region,
        city: address.city, area: address.area, streetLine: address.streetLine,
        deliveryInstructions: address.deliveryInstructions,
        subtotal, deliveryFee, total: subtotal + deliveryFee,
        vendorOrders: {
          create: vendorIds.map((vendorId) => ({
            vendorId,
            subtotal: vendorSubtotal(vendorId),
            deliveryFee: vendorFee(vendorId),
            total: vendorSubtotal(vendorId) + vendorFee(vendorId),
            items: {
              create: lines.filter((l) => l.vendorId === vendorId).map((l) => ({
                productId: l.productId, variantId: l.variantId, nameSnapshot: l.name,
                imageSnapshot: l.image, priceSnapshot: l.unitPrice, quantity: l.quantity,
              })),
            },
          })),
        },
      },
    });

    await tx.cartItem.deleteMany({ where: { userId: s.userId } });
    return created;
  });

  await audit({ req, actorId: s.userId, actorName: s.name, action: "order.placed", entityType: "order", entityId: order.id, meta: { orderNumber: order.orderNumber, total: order.total } });

  // Payment is opened with the gateway outside the DB transaction — it's an
  // external network call and must never hold transaction locks.
  const payment = await initiatePaymentForOrder(order.id, { method: body.paymentMethod, momoNetwork: body.momoNetwork, email: s.email });

  return ok({ ...order, payment }, 201);
});
