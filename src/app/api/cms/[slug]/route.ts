export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { handler, ok, Errors } from "@/lib/api";

export const GET = handler(async (_req: Request, { params }: { params: { slug: string } }) => {
  const page = await prisma.cmsPage.findUnique({ where: { slug: params.slug } });
  if (!page || !page.published) throw Errors.notFound("This page could not be found.");
  return ok({ slug: page.slug, title: page.title, content: page.content, updatedAt: page.updatedAt });
});
