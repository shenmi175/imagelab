import { env } from "@/lib/env";
import { jsonOk } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  return jsonOk({
    turnstileSiteKey: env.turnstileSiteKey
  });
}
