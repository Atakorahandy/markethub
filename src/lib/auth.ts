import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { verifyAccess, signAccess, signRefresh, AccessClaims } from "./jwt";
import { Errors } from "./api";
import { env } from "./env";
import { Permission, ALL_PERMISSIONS } from "./rbac";

export const ACCESS_COOKIE = "mh_at";
export const REFRESH_COOKIE = "mh_rt";

export type Session = {
  userId: string;
  name: string;
  email: string;
  kind: string; // customer | vendor | delivery_agent | staff
  roleKeys: string[];
  permissions: Set<Permission>;
  vendorIds: string[]; // vendors this user has a role in
  isSuperAdmin: boolean;
  isPlatformStaff: boolean;
  deliveryAgentId: string | null;
};

function bearer(req: Request): string | null {
  const h = req.headers.get("authorization");
  if (h?.toLowerCase().startsWith("bearer ")) return h.slice(7).trim();
  return null;
}

/** Resolve a session from the request. Returns null when unauthenticated.
 *  Roles & permissions are re-loaded from the DB every request — the token
 *  carries identity only, never a cached permission set. */
export async function getSession(req: Request): Promise<Session | null> {
  let token = bearer(req);
  if (!token) {
    try {
      token = cookies().get(ACCESS_COOKIE)?.value ?? null;
    } catch {
      token = null;
    }
  }
  if (!token) return null;

  let claims: AccessClaims;
  try {
    claims = await verifyAccess(token);
  } catch {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: claims.sub },
    include: {
      roles: { include: { role: { include: { permissions: true } } } },
      deliveryAgent: { select: { id: true } },
    },
  });
  if (!user || !user.isActive) return null;

  const permissions = new Set<Permission>();
  const roleKeys: string[] = [];
  const vendorIds = new Set<string>();
  let isSuperAdmin = false;
  let isPlatformStaff = false;

  for (const ur of user.roles) {
    roleKeys.push(ur.role.key);
    if (ur.role.key === "super_admin") {
      isSuperAdmin = true;
      ALL_PERMISSIONS.forEach((p) => permissions.add(p));
    }
    if (ur.role.scope === "platform" && ["platform_admin", "support_agent", "finance_officer"].includes(ur.role.key)) {
      isPlatformStaff = true;
    }
    for (const rp of ur.role.permissions) permissions.add(rp.permissionKey as Permission);
    if (ur.vendorId) vendorIds.add(ur.vendorId);
  }

  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    kind: user.kind,
    roleKeys,
    permissions,
    vendorIds: [...vendorIds],
    isSuperAdmin,
    isPlatformStaff,
    deliveryAgentId: user.deliveryAgent?.id ?? null,
  };
}

export async function requireAuth(req: Request): Promise<Session> {
  const s = await getSession(req);
  if (!s) throw Errors.unauthorized();
  return s;
}

export function can(session: Session, permission: Permission): boolean {
  return session.isSuperAdmin || session.permissions.has(permission);
}

export async function requirePermission(req: Request, permission: Permission): Promise<Session> {
  const s = await requireAuth(req);
  if (!can(s, permission)) throw Errors.forbidden();
  return s;
}

/** Require the user to be platform staff (any admin console permission). */
export async function requirePlatform(req: Request, permission: Permission): Promise<Session> {
  const s = await requirePermission(req, permission);
  if (!s.isSuperAdmin && !s.isPlatformStaff) throw Errors.forbidden();
  return s;
}

/** Require a permission AND that the session can act on this vendor.
 *  Platform staff pass through; vendor users must have a role there. */
export async function requireVendor(req: Request, vendorId: string, permission: Permission): Promise<Session> {
  const s = await requirePermission(req, permission);
  if (s.isSuperAdmin || s.isPlatformStaff) return s;
  if (!s.vendorIds.includes(vendorId)) throw Errors.forbidden();
  return s;
}

export async function requireDeliveryAgent(req: Request): Promise<Session & { deliveryAgentId: string }> {
  const s = await requireAuth(req);
  if (!s.deliveryAgentId) throw Errors.forbidden("Delivery agent profile required.");
  return s as Session & { deliveryAgentId: string };
}

// ── Session issuance ────────────────────────────────────────────────────────

export async function issueSession(
  user: { id: string; email: string; kind: string },
  ctx: { userAgent?: string; ip?: string } = {},
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const jti = crypto.randomUUID();
  const accessToken = await signAccess({ sub: user.id, email: user.email, kind: user.kind });
  const refreshToken = await signRefresh({ sub: user.id, jti });
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      jti,
      userAgent: ctx.userAgent ?? "",
      ip: ctx.ip ?? "",
      expiresAt: new Date(Date.now() + env.refreshTtl * 1000),
    },
  });
  return { accessToken, refreshToken, expiresIn: env.accessTtl };
}

/** Rotates a refresh token: the presented one is revoked and a brand-new
 *  jti issued in the same transaction, so a refresh token is single-use.
 *  Called only after the caller has confirmed the presented token is
 *  currently valid (not already revoked, not expired) — reuse of an
 *  already-rotated token is handled by the caller as a theft signal, not
 *  here. */
export async function rotateRefreshToken(
  oldTokenRowId: string,
  user: { id: string; email: string; kind: string },
  ctx: { userAgent?: string; ip?: string } = {},
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const jti = crypto.randomUUID();
  const accessToken = await signAccess({ sub: user.id, email: user.email, kind: user.kind });
  const refreshToken = await signRefresh({ sub: user.id, jti });
  await prisma.$transaction([
    prisma.refreshToken.update({ where: { id: oldTokenRowId }, data: { revokedAt: new Date() } }),
    prisma.refreshToken.create({
      data: {
        userId: user.id,
        jti,
        userAgent: ctx.userAgent ?? "",
        ip: ctx.ip ?? "",
        expiresAt: new Date(Date.now() + env.refreshTtl * 1000),
      },
    }),
  ]);
  return { accessToken, refreshToken, expiresIn: env.accessTtl };
}

export function setSessionCookies(res: Response, tokens: { accessToken: string; refreshToken: string }): void {
  const secure = env.isProd ? "; Secure" : "";
  res.headers.append(
    "Set-Cookie",
    `${ACCESS_COOKIE}=${tokens.accessToken}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=${env.accessTtl}`,
  );
  res.headers.append(
    "Set-Cookie",
    `${REFRESH_COOKIE}=${tokens.refreshToken}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=${env.refreshTtl}`,
  );
}

export function clearSessionCookies(res: Response): void {
  res.headers.append("Set-Cookie", `${ACCESS_COOKIE}=; Path=/; HttpOnly; Max-Age=0`);
  res.headers.append("Set-Cookie", `${REFRESH_COOKIE}=; Path=/; HttpOnly; Max-Age=0`);
}
