import { getRedis } from "@/lib/redis";
import { ApiError } from "@/lib/http";

export async function rateLimit(key: string, limit: number, windowSeconds: number) {
  if (limit <= 0) return;

  try {
    const redis = getRedis();
    const namespacedKey = `rate:${key}`;
    const count = await redis.incr(namespacedKey);
    if (count === 1) {
      await redis.expire(namespacedKey, windowSeconds);
    }
    if (count > limit) {
      throw new ApiError("RATE_LIMITED", "请求过于频繁，请稍后再试", 429);
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.warn("Rate limit skipped because Redis is unavailable.", error);
  }
}
