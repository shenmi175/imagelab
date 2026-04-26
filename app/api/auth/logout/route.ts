import { clearSession } from "@/lib/auth";
import { verifyCsrf } from "@/lib/csrf";
import { assertSameOrigin, jsonError, jsonOk } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await assertSameOrigin();
    await verifyCsrf(request);
    await clearSession();
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
