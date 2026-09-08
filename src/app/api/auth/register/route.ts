export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseBody, Errors } from "@/lib/api";
import { hashPassword } from "@/lib/crypto";
import { emailSchema, phoneSchema, passwordSchema } from "@/lib/validation";
import { issueSession, setSessionCookies } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { audit } from "@/lib/audit";
import { slugify } from "@/lib/ids";
import { verifyCaptcha } from "@/lib/captcha";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(120),
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
  // Self-serve roles only — staff/admin accounts are created by an administrator.
  role: z.enum(["customer", "vendor", "delivery_agent"]).default("customer"),
  // Vendor application fields (role=vendor)
  businessName: z.string().trim().max(120).optional(),
  city: z.string().trim().max(80).optional(),
  region: z.string().trim().max(80).optional(),
  // Delivery agent application fields (role=delivery_agent)
  vehicleType: z.enum(["bike", "motorbike", "car", "van", "on_foot"]).optional(),
  captchaToken: z.string().nullable().optional(),
});

export const POST = handler(async (req: Request) => {
  const ip = clientIp(req);
  rateLimit(`register:${ip}`, 10, 3600);
  const body = await parseBody(req, schema);
  if (!(await verifyCaptcha(body.captchaToken, ip))) throw Errors.validation({ captchaToken: "failed" }, "CAPTCHA verification failed. Please try again.");

  const existing = await prisma.user.findFirst({ where: { OR: [{ email: body.email }, { phone: body.phone }] } });
  if (existing) throw Errors.conflict("An account with that email or phone already exists.");

  const kind = body.role;

  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: {
        name: body.name,
        email: body.email,
        phone: body.phone,
        passwordHash: await hashPassword(body.password),
        kind,
      },
    });

    // Every self-registered account is a customer too.
    const customerRole = await tx.role.findUnique({ where: { key: "customer" } });
    if (customerRole) await tx.userRole.create({ data: { userId: u.id, roleId: customerRole.id } });

    if (body.role === "delivery_agent") {
      const agentRole = await tx.role.findUnique({ where: { key: "delivery_agent" } });
      if (agentRole) await tx.userRole.create({ data: { userId: u.id, roleId: agentRole.id } });
      await tx.deliveryAgent.create({
        data: {
          userId: u.id,
          status: "offline",
          verification: "pending",
          vehicleType: body.vehicleType ?? "motorbike",
          city: body.city ?? "",
          region: body.region ?? "",
        },
      });
    }

    if (body.role === "vendor") {
      const base = slugify(body.businessName || `${body.name}-store`);
      let slug = base;
      for (let i = 2; await tx.vendor.findUnique({ where: { slug } }); i++) slug = `${base}-${i}`;
      const v = await tx.vendor.create({
        data: {
          slug,
          businessName: body.businessName || `${body.name}'s Store`,
          ownerId: u.id,
          city: body.city ?? "",
          region: body.region ?? "",
          phone: body.phone,
          email: body.email,
          status: "pending",
        },
      });
      const ownerRole = await tx.role.findUnique({ where: { key: "vendor_owner" } });
      if (ownerRole) await tx.userRole.create({ data: { userId: u.id, roleId: ownerRole.id, vendorId: v.id } });
      await tx.vendorStaff.create({ data: { vendorId: v.id, userId: u.id, roleKey: "vendor_owner", jobTitle: "Owner" } });
    }

    return u;
  });

  const tokens = await issueSession(user, { userAgent: req.headers.get("user-agent") ?? "", ip });
  await audit({ req, actorId: user.id, actorName: user.name, action: "auth.register", entityType: "user", entityId: user.id, meta: { role: body.role } });

  const res = ok(
    { user: { id: user.id, name: user.name, email: user.email, kind: user.kind }, tokens },
    201,
  );
  setSessionCookies(res, tokens);
  return res;
});
