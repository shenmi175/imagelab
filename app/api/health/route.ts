import { jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { getRedis } from "@/lib/redis";

export const runtime = "nodejs";

export async function GET() {
  const health = {
    ok: true,
    version: "0.1.0",
    database: "unknown",
    redis: "unknown"
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    health.database = "ok";
  } catch {
    health.ok = false;
    health.database = "error";
  }

  try {
    await getRedis().ping();
    health.redis = "ok";
  } catch {
    health.ok = false;
    health.redis = "error";
  }

  return jsonOk(health, health.ok ? 200 : 503);
}
