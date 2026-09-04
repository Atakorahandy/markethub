# MarketHub

An original multi-vendor e-commerce marketplace for Ghana — independent stores, one
storefront, one checkout. Inspired by common marketplace functionality (à la Jumia);
no copied branding, UI, or code.

**This repo is Phase 1 of a 10-phase build.** See [Roadmap](#roadmap) below.

## Phase 1 — Foundation (this release)

- Project setup: Next.js 14 (App Router) + TypeScript + Tailwind, Prisma + PostgreSQL (Neon).
- Database: identity, RBAC (permissions/roles), vendor & delivery-agent onboarding records, audit log.
- Authentication: register (customer / vendor / delivery agent), login, logout, refresh, forgot/reset password. JWT access + refresh tokens in HttpOnly cookies; bcrypt password hashing; login rate limiting and lockout.
- Roles: full permission catalogue + system role presets (super admin, platform admin, support agent, finance officer, vendor owner, vendor staff, delivery agent, customer). Enforced server-side on every route — never trust the client.
- User management: admin console can search/suspend/activate users, and approve/reject/suspend vendor & delivery-agent applications.
- Basic UI system: design tokens, shared components, a storefront shell (header/footer) and a console shell reused by the admin, vendor and delivery-agent dashboards.

**Deliberately not built yet:** product catalog, cart, checkout, orders, payments, delivery jobs, reviews, coupons, disputes, wallets. These are later phases and would be premature to scaffold now — see the spec's phased plan.

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
| Vendor owner (approved) | owner@kumasifashion.test | Owner!2026 |
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

1. **Foundation** — this release.
2. **Marketplace** — categories, products, search, filters, vendor storefronts.
3. **Shopping** — cart, wishlist, addresses, checkout, orders.
4. **Payments** — Mobile Money & card payments, verification, webhooks.
5. **Vendor platform** — inventory, order fulfilment, wallet, commissions, withdrawals.
6. **Delivery** — assignment, tracking, proof of delivery, OTP confirmation.
7. **Admin** — full dashboard, moderation, refunds, reports, CMS.
8. **Advanced** — recommendations, flash sales, coupons, chat, support, analytics.
9. **Security** — OWASP audit, permission/payment/API testing.
10. **Production** — Docker (optional), CI/CD, monitoring, CDN.
