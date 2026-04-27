import { requireUser } from "@/lib/auth";
import { verifyCsrf } from "@/lib/csrf";
import { env } from "@/lib/env";
import { assertSameOrigin, jsonError, jsonOk, requestIpHash } from "@/lib/http";
import { createImageJob, getAuthorizedJob, publicJob } from "@/lib/jobs";
import { rateLimit } from "@/lib/rate-limit";
import { parseStoredInputImages, readImageFile } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(request: Request, context: any) {
  try {
    await assertSameOrigin();
    await verifyCsrf(request);

    const user = await requireUser();
    const ipHash = await requestIpHash();
    await rateLimit(`rerun-job:${user.id}:${ipHash}`, env.createJobUserMinuteLimit, 60);

    const { id } = await context.params;
    const source = await getAuthorizedJob(id, user);
    const inputImages = await Promise.all(
      parseStoredInputImages(source.inputImages).map(async (image) => ({
        buffer: await readImageFile(image.path),
        mime: image.mime,
        name: image.name
      }))
    );
    const job = await createImageJob({
      user,
      prompt: source.prompt,
      size: source.size,
      quality: source.quality,
      outputFormat: source.outputFormat,
      outputCompression: source.outputCompression,
      background: source.background,
      moderation: source.moderation,
      inputImages
    });

    return jsonOk({ ...publicJob(job), message: "已重新提交任务" }, 201);
  } catch (error) {
    return jsonError(error);
  }
}
