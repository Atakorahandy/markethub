/**
 * MARKETHUB permission catalogue + system-role presets.
 *
 * Permissions are enforced SERVER-SIDE on every mutating endpoint via
 * `requirePermission()` in src/lib/auth.ts. The client uses this list only to
 * hide controls — never as the security boundary.
 *
 * The catalogue covers the platform's full domain (spec §50) even though only
 * the identity/vendor/delivery-agent slice is wired up to real features in
 * Phase 1 — later phases (catalog, orders, payments, disputes, ...) consume
 * these same keys without further schema churn.
 */

export const PERMISSIONS = {
  "users.view": "View users",
  "users.manage": "Create, edit, suspend users",
  "vendors.view": "View vendors",
  "vendors.manage": "Approve, reject, suspend vendors",
  "products.view": "View products",
  "products.manage": "Create, edit, moderate any product",
  "categories.manage": "Create & edit categories",
  "orders.view": "View orders",
  "orders.manage": "Advance order status, cancel, refund",
  "payments.view": "View payments & transactions",
  "payments.manage": "Reconcile payments",
  "withdrawals.view": "View vendor withdrawal requests",
  "withdrawals.manage": "Approve / reject withdrawal requests",
  "promotions.manage": "Create & edit coupons & promotions",
  "reviews.manage": "Moderate reviews",
  "disputes.manage": "Handle disputes & refunds",
  "deliveries.view": "View deliveries",
  "deliveries.manage": "Assign & manage deliveries",
  "reports.view": "View reports & analytics",
  "reports.export": "Export reports",
  "settings.manage": "Edit platform settings",
  "audit.view": "View audit logs",
  // Vendor-scoped (checked together with vendor membership, not just presence)
  "store.manage": "Manage own store profile & settings",
  "products.manage_own": "Manage own products & inventory",
  "orders.manage_own": "Manage own store's orders",
  "wallet.view": "View own wallet & earnings",
  "withdrawals.create": "Request a withdrawal",
  // Customer
  "profile.manage": "Manage own profile & addresses",
  "cart.manage": "Manage own cart & wishlist",
  "orders.create": "Place orders",
  "orders.view_own": "View own orders",
  "reviews.create": "Leave reviews",
  // Delivery agent
  "deliveries.view_assigned": "View assigned deliveries",
  "deliveries.update_assigned": "Update status of assigned deliveries",
} as const;

export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

type Preset = {
  key: string;
  name: string;
  scope: "platform" | "vendor";
  permissions: Permission[] | "*";
};

export const SYSTEM_ROLES: Preset[] = [
  // ── Platform ──────────────────────────────────────────────────────────────
  { key: "super_admin", name: "Super Admin", scope: "platform", permissions: "*" },
  {
    key: "platform_admin",
    name: "Platform Admin",
    scope: "platform",
    permissions: [
      "users.view", "users.manage",
      "vendors.view", "vendors.manage",
      "products.view", "products.manage", "categories.manage",
      "orders.view", "orders.manage",
      "payments.view",
      "withdrawals.view", "withdrawals.manage",
      "promotions.manage",
      "reviews.manage", "disputes.manage",
      "deliveries.view", "deliveries.manage",
      "reports.view", "reports.export",
      "settings.manage", "audit.view",
    ],
  },
  {
    key: "support_agent",
    name: "Support Agent",
    scope: "platform",
    permissions: ["users.view", "vendors.view", "orders.view", "orders.manage", "reviews.manage", "disputes.manage", "deliveries.view"],
  },
  {
    key: "finance_officer",
    name: "Finance Officer",
    scope: "platform",
    permissions: ["payments.view", "payments.manage", "withdrawals.view", "withdrawals.manage", "reports.view", "reports.export", "disputes.manage", "audit.view"],
  },
  // ── Vendor ────────────────────────────────────────────────────────────────
  {
    key: "vendor_owner",
    name: "Vendor Owner",
    scope: "vendor",
    permissions: [
      "store.manage", "products.manage_own", "orders.manage_own",
      "wallet.view", "withdrawals.create", "promotions.manage",
      "reviews.manage", "reports.view",
    ],
  },
  {
    key: "vendor_staff",
    name: "Vendor Staff",
    scope: "vendor",
    permissions: ["products.manage_own", "orders.manage_own"],
  },
  // ── Delivery / Customer ──────────────────────────────────────────────────
  {
    key: "delivery_agent",
    name: "Delivery Agent",
    scope: "platform",
    permissions: ["deliveries.view_assigned", "deliveries.update_assigned"],
  },
  {
    key: "customer",
    name: "Customer",
    scope: "platform",
    permissions: ["profile.manage", "cart.manage", "orders.create", "orders.view_own", "reviews.create"],
  },
];

export function presetPermissions(p: Preset): Permission[] {
  return p.permissions === "*" ? ALL_PERMISSIONS : p.permissions;
}
