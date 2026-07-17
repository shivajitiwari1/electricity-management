import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

function createPrismaAdapter() {
  const url = process.env.DATABASE_URL ?? "";
  const parsed = new URL(url);
  const useSSL = process.env.DATABASE_SSL === "true" || parsed.hostname !== "localhost";
  return new PrismaMariaDb({
    host: parsed.hostname || "localhost",
    port: parsed.port ? parseInt(parsed.port, 10) : 3306,
    user: parsed.username || "root",
    password: parsed.password || undefined,
    database: parsed.pathname.slice(1).split("?")[0] || undefined,
    ...(useSSL ? { ssl: { rejectUnauthorized: false } } : {}),
    connectTimeout: 30000,
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: createPrismaAdapter(),
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
