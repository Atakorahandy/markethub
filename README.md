# MarketHub

An original multi-vendor e-commerce marketplace for Ghana — independent stores, one
storefront, one checkout. Inspired by common marketplace functionality (à la Jumia);
no copied branding, UI, or code.

**This repo is Phase 5 of a 10-phase build.** See [Roadmap](#roadmap) below.

## Phase 1 — Foundation

- Project setup: Next.js 14 (App Router) + TypeScript + Tailwind, Prisma + PostgreSQL (Neon).
- Database: identity, RBAC (permissions/roles), vendor & delivery-agent onboarding records, audit log.
- Authentication: register (customer / vendor / delivery agent), login, logout, refresh, forgot/reset password. JWT access + refresh tokens in HttpOnly cookies; bcrypt password hashing; login rate limiting and lockout.
- Roles: full permission catalogue + system role presets (super admin, platform admin, support agent, finance officer, vendor owner, vendor staff, delivery agent, customer). Enforced server-side on every route — never trust the client.
- User management: admin console can search/suspend/activate users, and approve/reject/suspend vendor & delivery-agent applications.
- Basic UI system: design tokens, shared components, a storefront shell (header/footer) and a console shell reused by the admin, vendor and delivery-agent dashboards.

## Phase 2 — Marketplace

- Database: `Category` (self-referencing, two levels), `Brand`, `Product` (integer-pesewas pricing, JSON-string images/tags/specs), simple `ProductVariant`.
- Public storefront: `/products` (search + category/brand/price filters + sort + pagination), `/product/[slug]` (gallery, variants, specs, vendor card), `/store/[slug]` (vendor storefront), `/categories`, home page now shows real categories and new arrivals.
- Vendor console: `/vendor/products` (list/add/edit/delete own products — gated on an **approved** store), `/vendor/store` (edit description/logo/banner, which the public store page renders).
- Admin console: `/admin/categories`, `/admin/brands` (create/delete taxonomy).
- All catalog reads exclude non-approved vendors and non-active products server-side — a suspended vendor's listings disappear from the storefront even if a product row still exists.

## Phase 3 — Shopping

- Database: `Address`, flat per-user `CartItem`/`WishlistItem` (no guest-cart wrapper — Phase 3 requires login to shop), `Order` + `VendorOrder` + `OrderItem` (multi-vendor split per spec §22, with a full address/price/name snapshot on every order so later catalog edits never rewrite history).
- Cart & wishlist: `/cart` (per-vendor grouping, live stock/availability checks, delivery fee per vendor), `/wishlist` (move-to-cart), header cart badge shared via `CartProvider`. Add to Cart / Buy Now / wishlist are wired up on the product page.
- Addresses: `/account/addresses` full CRUD, Ghana region picker, one default address.
- Checkout: `/checkout` — address selection, per-vendor order review, idempotent submit (a client-generated UUID means a double-click or retry returns the same order instead of creating a duplicate). Stock is checked and decremented atomically inside a DB transaction (`stock: { gte: qty }` conditional update, not read-then-write) so two customers can never oversell the last unit.
- Orders: `/orders` (history), `/orders/[orderNumber]` (detail, cancel-while-unpaid with automatic stock restoration).

## Phase 4 — Payments

- Database: `Payment` (one per Order), `PaymentTransaction` (append-only log of every initiate/verify/webhook attempt — an audit trail independent of the mutable `Payment` row), `PaymentWebhook` (idempotency + replay protection for gateway callbacks).
- Provider-agnostic gateway layer (`src/lib/payments`): a `PaymentProvider` interface with `initiate` / `verify` / `parseWebhook`, selected by `PAYMENT_PROVIDER` env var. Two providers ship:
  - **mock** (default, needs no keys) — a real settlement path with its own hosted-looking page at `/pay/mock/[reference]`, its own HMAC-signed webhook, full transaction/audit logging. Nothing about it is faked client-side; approving fires the exact same webhook-ingestion code a real gateway would.
  - **paystack** — cards + Mobile Money (MTN, Telecel, AirtelTigo) for Ghana. Set `PAYMENT_PROVIDER=paystack` + `PAYSTACK_SECRET_KEY` and register `/api/payments/webhook` in the Paystack dashboard.
- Checkout now opens a real payment after placing the order (`POST /api/checkout` creates the order **and** initiates payment in one call) and redirects to the gateway's `authorizationUrl`. `/orders/[orderNumber]` shows a "Pay now" retry for any order still `pending_payment` (abandoned checkout, failed attempt) — each retry opens a fresh payment reference against the same order.
- **A gateway result is never trusted from the client.** `verifyAndSettle()` always re-fetches the transaction from the gateway itself before marking anything paid; the Paystack webhook's signature is verified over the raw request body (HMAC-SHA512, timing-safe compare) and, even after a valid signature, the transaction is re-verified against the API rather than trusting the webhook payload's status/amount. An amount or currency mismatch between what the gateway reports and what the order expects throws instead of settling (`spec §78` — the classic amount-manipulation attack). Settlement itself is idempotent: replays (duplicate webhook, a second "I've paid" click) are detected and become silent no-ops, verified in testing by re-submitting an already-successful mock settlement and confirming `paidAt` doesn't move and the order isn't touched twice.
- `Order.status` gains `paid` alongside `pending_payment`/`cancelled`; `VendorOrder.status` mirrors it.

## Phase 5 — Vendor Platform (this release)

- Database: `VendorOrderStatusHistory` (immutable fulfilment timeline per spec §21), `InventoryTransaction` (a ledger of every stock movement — sale/return/adjustment — separate from the fast mutable `Product.stock` counter), `WalletLedgerEntry` (a vendor's balance is **always** the sum of this ledger, never a mutable running total, per spec §30), `Withdrawal` (vendor payout requests, admin-approved).
- Order fulfilment: `VendorOrder.status` now advances `paid → processing → shipped → delivered`, one step at a time, at `/vendor/orders` (list, filterable) and `/vendor/orders/[id]` (detail, advance-status action, status history timeline).
- Wallet: `/vendor/wallet` shows the live balance and recent ledger activity. Marking a `VendorOrder` **delivered** credits the vendor's wallet with two paired entries — a gross "sale" credit (subtotal + delivery fee) and a "commission" debit (`Vendor.commissionBps`, or the `DEFAULT_COMMISSION_BPS` platform default) — so the platform's cut is auditable, not just netted away silently.
- Withdrawals: a vendor requests one from their wallet page (funds are reserved immediately via a debit ledger entry, so the same balance can't be withdrawn twice); `/admin/withdrawals` lets an admin approve → mark paid out, or reject (which reverses the hold with a `withdrawal_reversal` ledger entry, verified in testing to restore the exact prior balance). Payout bank/Mobile Money details live on `/vendor/store`.
- Admin can set a per-vendor commission override from `/admin/vendors` (falls back to the platform default when unset).
- Inventory: every stock-changing event — a sale at checkout, a return on cancellation, a vendor's manual stock edit — writes an `InventoryTransaction`, not just an update to the counter. The vendor products list flags anything at or below its low-stock threshold.

**Deliberately not built yet:** delivery jobs, reviews, coupons, disputes, product-approval moderation, refunds, image upload (image fields take a URL — object storage is a later phase), low-stock notifications (a visual badge exists; push/email/SMS alerts are Phase 8's notification system). These are later phases and would be premature to scaffold now — see the spec's phased plan.

## Getting started

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL (Neon) and JWT secrets
npm run setup           # prisma migrate dev + seed demo data
npm run dev
```

Generate real secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### Local database

For production, point `DATABASE_URL` at Neon (matches the rest of the portfolio).
For local development without Docker, this machine already has a native PostgreSQL 16
service installed, so Phase 1 was verified against an isolated local cluster instead:

```bash
# one-time: create an isolated data dir + start it on a dedicated port
initdb -D ./.pgdata -U markethub -A trust --locale=C --encoding=UTF8
pg_ctl -D ./.pgdata -o "-p 5434" -l ./.pgdata/server.log start
createdb -U markethub -h localhost -p 5434 markethub

# subsequent sessions: just start/stop it
pg_ctl -D ./.pgdata -o "-p 5434" -l ./.pgdata/server.log start
pg_ctl -D ./.pgdata stop
```

`.pgdata/` is gitignored — it's a local dev cluster, not part of the repo. With it
running, `.env`'s `DATABASE_URL="postgresql://markethub@localhost:5434/markethub?schema=public"`
matches, and `npm run setup` / `npm run dev` work exactly as above. If Docker is
available instead, a `docker-compose.yml` following the same pattern as the sibling
projects (foodhub, laundrypro, traffic-command) is a straightforward addition.

### Demo logins (after `npm run setup`)

| Role | Email | Password |
|---|---|---|
| Super admin | value of `SEED_SUPERADMIN_EMAIL` | value of `SEED_SUPERADMIN_PASSWORD` |
| Platform admin | admin.ops@markethub.test | Admin!2026 |
| Support agent | support@markethub.test | Support!2026 |
| Finance officer | finance@markethub.test | Finance!2026 |
| Vendor owner (pending review) | owner@accraelectronics.test | Owner!2026 |
| Vendor owner (approved, has products) | owner@kumasifashion.test | Owner!2026 |
| Vendor owner (approved, has products) | owner@techzone.test | Owner!2026 |
| Delivery agent (pending verification) | kwame.rider@markethub.test | Rider!2026 |
| Customer | ama@markethub.test | Customer!2026 |

All demo data is clearly fictional. Change every password before using real data.

## Architecture

- **Web app**: `src/app` — Next.js App Router. Route groups: `(auth)` for sign-in/up,
  `(shop)` for the customer storefront, plus `admin/`, `vendor/`, `delivery/` consoles.
- **API**: `src/app/api/**/route.ts` — REST-style handlers, consistent `{ ok, data }` /
  `{ ok: false, error }` envelope (`src/lib/api.ts`).
- **Auth**: `src/lib/jwt.ts` + `src/lib/auth.ts` — HS256 JWT access/refresh tokens in
  HttpOnly cookies. Every request re-loads roles/permissions from the database; the
  token carries identity only, never a cached permission set.
- **RBAC**: `src/lib/rbac.ts` — the full permission catalogue and system-role presets,
  seeded by `prisma/seed.ts`. `requirePermission` / `requirePlatform` / `requireVendor`
  / `requireDeliveryAgent` in `src/lib/auth.ts` are the server-side enforcement points.
- **Database**: `prisma/schema.prisma` — PostgreSQL via Prisma. Enum-like columns are
  plain strings validated in the app layer, so the schema stays portable.

## Environment variables

See [.env.example](.env.example). `DATABASE_URL` must point to a real PostgreSQL
instance (Neon recommended) — `prisma migrate deploy` will fail without one, which is
why `npm run build:noprisma` exists for environments where the database isn't
provisioned yet.

## Roadmap

1. **Foundation** — done.
2. **Marketplace** — done.
3. **Shopping** — done.
4. **Payments** — done.
5. **Vendor platform** — this release.
6. **Delivery** — assignment, tracking, proof of delivery, OTP confirmation.
7. **Admin** — full dashboard, moderation, refunds, reports, CMS.
8. **Advanced** — recommendations, flash sales, coupons, chat, support, analytics.
9. **Security** — OWASP audit, permission/payment/API testing.
10. **Production** — Docker (optional), CI/CD, monitoring, CDN.
