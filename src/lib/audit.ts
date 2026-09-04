import { prisma } from "./prisma";
import { clientIp } from "./ratelimit";

type AuditInput = {
  req?: Request;
  actorId?: string | null;
  actorName?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  meta?: unknown;
};

/** Fire-and-forget audit write. Never throws into the request path. */
export async function audit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        actorName: input.actorName ?? "",
        action: input.action,
        entityType: input.entityType ?? "",
        entityId: input.entityId ?? "",
        meta: JSON.stringify(input.meta ?? {}),
        ip: input.req ? clientIp(input.req) : "",
      },
    });
  } catch (e) {
    console.error("[audit] failed:", e);
  }
}
