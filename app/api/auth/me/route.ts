import { currentUser, publicUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { remainingQuota } from "@/lib/jobs";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return jsonOk({ user: null });
    return jsonOk({ user: publicUser(user), remainingQuota: await remainingQuota(user) });
  } catch (error) {
    return jsonError(error);
  }
}
