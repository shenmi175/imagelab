import { requireAdmin } from "@/lib/auth";
import { env } from "@/lib/env";
import { jsonError, jsonOk } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();
    return jsonOk({
      queueBoardUrl: env.queueBoardPublicUrl
    });
  } catch (error) {
    return jsonError(error);
  }
}
