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
 *  Vendor owner (approved): owner@kumasifashion.test    / Owner!2026 (Kumasi Fashion House — has products)
 *  Vendor owner (approved): owner@techzone.test         / Owner!2026 (TechZone Ghana — has products)
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
    { name: "Yaw Osei", email: "owner@techzone.test", phone: "0244555666", business: "TechZone Ghana", city: "Accra", region: "Greater Accra", status: "approved" },
  ];
  const vendorBySlug: Record<string, { id: string }> = {};
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
    vendorBySlug[slug] = vendor;
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

  // ── Categories, brands & demo products ───────────────────────────────────
  const categoryTree: Record<string, string[]> = {
    Electronics: ["Smartphones", "Laptops", "Headphones"],
    Fashion: ["Men's Fashion", "Women's Fashion", "Shoes"],
    Home: ["Furniture", "Kitchen"],
    Beauty: ["Skincare"],
    Sports: ["Fitness"],
  };
  const categoryId: Record<string, string> = {};
  let order = 0;
  for (const [top, subs] of Object.entries(categoryTree)) {
    const topSlug = slugify(top);
    const topCat = await prisma.category.upsert({
      where: { slug: topSlug },
      create: { slug: topSlug, name: top, sortOrder: order++ },
      update: {},
    });
    categoryId[top] = topCat.id;
    for (const sub of subs) {
      const subSlug = slugify(`${top}-${sub}`);
      const subCat = await prisma.category.upsert({
        where: { slug: subSlug },
        create: { slug: subSlug, name: sub, parentId: topCat.id, sortOrder: order++ },
        update: {},
      });
      categoryId[sub] = subCat.id;
    }
  }
  console.log("  ✓ categories");

  const brandNames = ["Samsung", "Apple", "Nike", "Adidas"];
  const brandId: Record<string, string> = {};
  for (const name of brandNames) {
    const slug = slugify(name);
    const brand = await prisma.brand.upsert({ where: { slug }, create: { slug, name }, update: {} });
    brandId[name] = brand.id;
  }
  console.log("  ✓ brands");

  type DemoProduct = {
    vendor: string; category: string; brand?: string; name: string; price: number; discountPrice?: number;
    stock: number; description: string; images: string[]; tags: string[];
  };
  const products: DemoProduct[] = [
    {
      vendor: "techzone-ghana", category: "Smartphones", brand: "Samsung", name: "Samsung Galaxy A54 5G",
      price: 320000, discountPrice: 299900, stock: 25,
      description: "6.4-inch Super AMOLED display, 50MP triple camera, 5000mAh battery. Demo listing.",
      images: ["https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800&q=80"],
      tags: ["5G", "android"],
    },
    {
      vendor: "techzone-ghana", category: "Smartphones", brand: "Apple", name: "iPhone 13 128GB",
      price: 520000, stock: 12,
      description: "6.1-inch Super Retina XDR display, A15 Bionic chip. Demo listing.",
      images: ["https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&q=80"],
      tags: ["ios"],
    },
    {
      vendor: "techzone-ghana", category: "Laptops", name: "HP Pavilion 15 Laptop",
      price: 680000, stock: 8,
      description: "Intel Core i5, 8GB RAM, 512GB SSD, 15.6-inch FHD display. Demo listing.",
      images: ["https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800&q=80"],
      tags: ["laptop", "intel"],
    },
    {
      vendor: "techzone-ghana", category: "Headphones", name: "JBL Tune 510BT Wireless Headphones",
      price: 45000, discountPrice: 38000, stock: 40,
      description: "Bluetooth 5.0, up to 40 hours battery life, pure bass sound. Demo listing.",
      images: ["https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=800&q=80"],
      tags: ["bluetooth", "audio"],
    },
    {
      vendor: "kumasi-fashion-house", category: "Women's Fashion", name: "Ankara Print Wrap Dress",
      price: 18000, stock: 15,
      description: "Handmade Ankara wrap dress, breathable cotton blend. Demo listing.",
      images: ["https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800&q=80"],
      tags: ["ankara", "dress"],
    },
    {
      vendor: "kumasi-fashion-house", category: "Men's Fashion", name: "Men's Kente-Trim Shirt",
      price: 22000, stock: 20,
      description: "Cotton shirt with traditional Kente-pattern trim. Demo listing.",
      images: ["https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&q=80"],
      tags: ["kente", "menswear"],
    },
    {
      vendor: "kumasi-fashion-house", category: "Shoes", brand: "Nike", name: "Leather Sandals",
      price: 15000, stock: 30,
      description: "Genuine leather sandals, handcrafted. Demo listing.",
      images: ["https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800&q=80"],
      tags: ["sandals", "leather"],
    },
  ];

  for (const p of products) {
    const vendor = vendorBySlug[p.vendor];
    if (!vendor) continue;
    const slug = slugify(p.name);
    await prisma.product.upsert({
      where: { slug },
      create: {
        slug, vendorId: vendor.id, categoryId: categoryId[p.category], brandId: p.brand ? brandId[p.brand] : null,
        name: p.name, price: p.price, discountPrice: p.discountPrice ?? null, stock: p.stock,
        description: p.description, shortDescription: p.description.slice(0, 100),
        images: JSON.stringify(p.images), tags: JSON.stringify(p.tags), status: "active",
        isFeatured: p.discountPrice != null,
      },
      update: {},
    });
  }
  console.log("  ✓ demo products");

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
