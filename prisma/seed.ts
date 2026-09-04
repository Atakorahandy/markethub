/**
 * MARKETHUB — demo seed.   npm run db:seed
 *
 * Everything created here is CLEARLY MARKED demo/test data. It is not real.
 * Change every password after first sign-in.
 *
 * ── Logins ────────────────────────────────────────────────────────────────
 *  Super admin      : env SEED_SUPERADMIN_EMAIL / SEED_SUPERADMIN_PASSWORD
 *  Platform admin    : admin.ops@markethub.test      / Admin!2026
 *  Support agent      : support@markethub.test        / Support!2026
 *  Finance officer   : finance@markethub.test         / Finance!2026
 *  Vendor owner (pending) : owner@accraelectronics.test / Owner!2026 (Accra Electronics Hub)
 *  Vendor owner (approved): owner@kumasifashion.test    / Owner!2026 (Kumasi Fashion House)
 *  Delivery agent (pending): kwame.rider@markethub.test / Rider!2026
 *  Customer          : ama@markethub.test              / Customer!2026
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { PERMISSIONS, SYSTEM_ROLES, presetPermissions } from "../src/lib/rbac";
import { slugify } from "../src/lib/ids";

const prisma = new PrismaClient({ transactionOptions: { timeout: 30_000, maxWait: 10_000 } });
const hash = (s: string) => bcrypt.hash(s, 10);

/** Grant a platform-scoped role (vendorId: null). Prisma's compound-unique
 *  `where` input for a nullable field doesn't accept `null` directly, so this
 *  uses findFirst + create instead of upsert. */
async function grantPlatformRole(userId: string, roleId: string) {
  const existing = await prisma.userRole.findFirst({ where: { userId, roleId, vendorId: null } });
  if (!existing) await prisma.userRole.create({ data: { userId, roleId } });
}

async function main() {
  console.log("→ Seeding MarketHub (demo data)…");

  // ── Permissions + roles ──────────────────────────────────────────────────
  for (const [key, description] of Object.entries(PERMISSIONS)) {
    await prisma.permission.upsert({ where: { key }, create: { key, description }, update: { description } });
  }
  for (const preset of SYSTEM_ROLES) {
    const role = await prisma.role.upsert({
      where: { key: preset.key },
      create: { key: preset.key, name: preset.name, scope: preset.scope, isSystem: true },
      update: { name: preset.name, scope: preset.scope },
    });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    const perms = presetPermissions(preset);
    if (perms.length) {
      await prisma.rolePermission.createMany({ data: perms.map((p) => ({ roleId: role.id, permissionKey: p })) });
    }
  }
  const roleId = Object.fromEntries((await prisma.role.findMany()).map((r) => [r.key, r.id]));
  console.log("  ✓ permissions + roles");

  // ── Super admin (from env) ──────────────────────────────────────────────
  const superEmail = process.env.SEED_SUPERADMIN_EMAIL ?? "admin@markethub.app";
  const superPassword = process.env.SEED_SUPERADMIN_PASSWORD ?? "ChangeMe!Admin123";
  const superAdmin = await prisma.user.upsert({
    where: { email: superEmail },
    create: { name: "Super Admin", email: superEmail, passwordHash: await hash(superPassword), kind: "staff", emailVerifiedAt: new Date() },
    update: {},
  });
  await grantPlatformRole(superAdmin.id, roleId.super_admin);
  console.log(`  ✓ super admin (${superEmail})`);

  // ── Platform staff ───────────────────────────────────────────────────────
  const staff: Array<{ email: string; name: string; roleKey: string }> = [
    { email: "admin.ops@markethub.test", name: "Ops Admin", roleKey: "platform_admin" },
    { email: "support@markethub.test", name: "Support Agent", roleKey: "support_agent" },
    { email: "finance@markethub.test", name: "Finance Officer", roleKey: "finance_officer" },
  ];
  for (const s of staff) {
    const pwd = `${s.roleKey.split("_")[0][0].toUpperCase()}${s.roleKey.split("_")[0].slice(1)}!2026`;
    const u = await prisma.user.upsert({
      where: { email: s.email },
      create: { name: s.name, email: s.email, passwordHash: await hash(pwd), kind: "staff", emailVerifiedAt: new Date() },
      update: {},
    });
    await grantPlatformRole(u.id, roleId[s.roleKey]);
  }
  console.log("  ✓ platform staff");

  // ── Demo vendors ─────────────────────────────────────────────────────────
  const vendorSeeds = [
    { name: "Kojo Mensah", email: "owner@accraelectronics.test", phone: "0244111222", business: "Accra Electronics Hub", city: "Accra", region: "Greater Accra", status: "pending" },
    { name: "Ama Boateng", email: "owner@kumasifashion.test", phone: "0244333444", business: "Kumasi Fashion House", city: "Kumasi", region: "Ashanti", status: "approved" },
  ];
  for (const v of vendorSeeds) {
    const owner = await prisma.user.upsert({
      where: { email: v.email },
      create: { name: v.name, email: v.email, phone: v.phone, passwordHash: await hash("Owner!2026"), kind: "vendor", emailVerifiedAt: new Date() },
      update: {},
    });
    await grantPlatformRole(owner.id, roleId.customer);
    const slug = slugify(v.business);
    const vendor = await prisma.vendor.upsert({
      where: { slug },
      create: {
        slug, businessName: v.business, ownerId: owner.id, city: v.city, region: v.region,
        phone: v.phone, email: v.email, status: v.status,
      },
      update: { status: v.status },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId_vendorId: { userId: owner.id, roleId: roleId.vendor_owner, vendorId: vendor.id } },
      create: { userId: owner.id, roleId: roleId.vendor_owner, vendorId: vendor.id },
      update: {},
    });
    await prisma.vendorStaff.upsert({
      where: { vendorId_userId: { vendorId: vendor.id, userId: owner.id } },
      create: { vendorId: vendor.id, userId: owner.id, roleKey: "vendor_owner", jobTitle: "Owner" },
      update: {},
    });
  }
  console.log("  ✓ demo vendors");

  // ── Demo delivery agent ──────────────────────────────────────────────────
  const rider = await prisma.user.upsert({
    where: { email: "kwame.rider@markethub.test" },
    create: { name: "Kwame Rider", email: "kwame.rider@markethub.test", passwordHash: await hash("Rider!2026"), kind: "delivery_agent", emailVerifiedAt: new Date() },
    update: {},
  });
  await grantPlatformRole(rider.id, roleId.delivery_agent);
  await prisma.deliveryAgent.upsert({
    where: { userId: rider.id },
    create: { userId: rider.id, status: "offline", verification: "pending", vehicleType: "motorbike", city: "Accra", region: "Greater Accra" },
    update: {},
  });
  console.log("  ✓ demo delivery agent");

  // ── Demo customer ────────────────────────────────────────────────────────
  const customer = await prisma.user.upsert({
    where: { email: "ama@markethub.test" },
    create: { name: "Ama Serwaa", email: "ama@markethub.test", phone: "0201234567", passwordHash: await hash("Customer!2026"), kind: "customer", emailVerifiedAt: new Date() },
    update: {},
  });
  await grantPlatformRole(customer.id, roleId.customer);
  console.log("  ✓ demo customer");

  console.log("→ Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
