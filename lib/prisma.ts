// Single shared PrismaClient instance.
//
// NOTE: the import below resolves after `npx prisma generate`
// has generated the client into lib/generated/prisma.
import { PrismaClient } from "./generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const rawUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  const connectionString = rawUrl?.replace(
    /([?&])sslmode=(?:require|prefer|verify-ca)\b/i,
    "$1sslmode=verify-full",
  );

  const pool = new pg.Pool({ connectionString, max: 10 });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
