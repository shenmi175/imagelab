import { requireUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { getAuthorizedJob, publicJob } from "@/lib/jobs";

export const runtime = "nodejs";

export async function GET(_request: Request, context: any) {
  try {
    const user = await requireUser();
    const job = await getAuthorizedJob(context.params.id, user);
    return jsonOk(publicJob(job));
  } catch (error) {
    return jsonError(error);
  }
}
