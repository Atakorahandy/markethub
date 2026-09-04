import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    // Serverless functions talk to managed Postgres over the network; multi-step
    // writes need more than the default 5s.
    transactionOptions: { timeout: 20_000, maxWait: 8_000 },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
