export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseBody } from "@/lib/api";
import { requirePlatform } from "@/lib/auth";
import { idSchema } from "@/lib/validation";
import { audit } from "@/lib/audit";

const schema = z.object({
  status: z.enum(["under_review", "approved", "rejected", "suspended"]),
  rejectionNote: z.string().trim().max(500).optional(),
});

export const PATCH = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const s = await requirePlatform(req, "vendors.manage");
  const id = idSchema.parse((await params).id);
  const body = await parseBody(req, schema);

  const vendor = await prisma.vendor.update({
    where: { id },
    data: { status: body.status, rejectionNote: body.status === "rejected" ? body.rejectionNote ?? "" : "" },
  });

  await audit({
    req,
    actorId: s.userId,
    actorName: s.name,
    action: `vendor.${body.status}`,
    entityType: "vendor",
    entityId: vendor.id,
    meta: { rejectionNote: body.rejectionNote },
  });

  return ok(vendor);
});
