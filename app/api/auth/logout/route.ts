import { auth } from "@/lib/better-auth";
import { verifyCsrf } from "@/lib/csrf";
import { assertSameOrigin, jsonError, jsonOkWithHeaders } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await assertSameOrigin();
    await verifyCsrf(request);
    const result = await auth.api.signOut({
      headers: request.headers,
      returnHeaders: true,
      returnStatus: true
    });
    return jsonOkWithHeaders({ ok: true }, result.headers, 200);
  } catch (error) {
    return jsonError(error);
  }
}
