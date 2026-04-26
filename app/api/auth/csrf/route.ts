import { issueCsrfToken } from "@/lib/csrf";
import { jsonError, jsonOk } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  try {
    const csrfToken = await issueCsrfToken();
    return jsonOk({ csrfToken });
  } catch (error) {
    return jsonError(error);
  }
}
