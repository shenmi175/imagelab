import { JobStatus, UserRole } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { verifyCsrf } from "@/lib/csrf";
import { env } from "@/lib/env";
import { ApiError, assertSameOrigin, jsonError, jsonOk, requestIpHash } from "@/lib/http";
import { createImageJob, publicJob, type PendingInputImage } from "@/lib/jobs";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { validateBackground, validateModeration, validateOutputCompression, validateOutputFormat, validatePrompt, validateQuality, validateSize } from "@/lib/validation";

export const runtime = "nodejs";

const visibleStatuses = new Set(["PENDING_ENQUEUE", "QUEUED", "RUNNING", "COMPLETED", "FAILED", "CANCELED", "EXPIRED"]);
const maxUploadFiles = 4;

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

function isUploadFile(value: FormDataEntryValue): value is File {
  return typeof value === "object" && "arrayBuffer" in value && "size" in value && value.size > 0;
}

async function uploadedImages(formData: FormData) {
  const files = [...formData.getAll("image[]"), ...formData.getAll("image")].filter(isUploadFile);
  if (files.length > maxUploadFiles) {
    throw new ApiError("INVALID_INPUT", `最多上传 ${maxUploadFiles} 张参考图`);
  }

  return Promise.all(
    files.map(async (file) => ({
      buffer: Buffer.from(await file.arrayBuffer()),
      mime: file.type,
      name: file.name
    }))
  );
}

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const ipHash = await requestIpHash();
    await rateLimit(`poll:${user.id}:${ipHash}`, env.pollUserMinuteLimit, 60);

    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const scope = url.searchParams.get("scope");
    const cursor = url.searchParams.get("cursor");
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 24, 1), 50);
    const statusFilter = status && visibleStatuses.has(status) ? { status: status as JobStatus } : {};
    const ownerFilter = user.role === UserRole.ADMIN && scope === "all" ? {} : { userId: user.id };

    const items = await prisma.imageJob.findMany({
      where: {
        ...ownerFilter,
        ...statusFilter
      },
      orderBy: { createdAt: "desc" },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: limit + 1
    });

    const visibleItems = items.slice(0, limit);
    const nextCursor = items.length > limit ? items[limit].id : null;

    return jsonOk({ items: visibleItems.map(publicJob), nextCursor });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    await assertSameOrigin();
    await verifyCsrf(request);
    const user = await requireUser();
    const ipHash = await requestIpHash();
    await rateLimit(`create-job:${user.id}:${ipHash}`, env.createJobUserMinuteLimit, 60);

    const contentType = request.headers.get("content-type") ?? "";
    let prompt: string;
    let size: string;
    let quality: string;
    let outputFormat: string;
    let outputCompression: number | null;
    let background: string;
    let moderation: string;
    let inputImages: PendingInputImage[];

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      prompt = validatePrompt(formString(formData, "prompt"));
      size = validateSize(formString(formData, "size"));
      quality = validateQuality(formString(formData, "quality"));
      outputFormat = validateOutputFormat(formString(formData, "output_format") ?? formString(formData, "outputFormat"));
      outputCompression = validateOutputCompression(outputFormat, formString(formData, "output_compression") ?? formString(formData, "outputCompression"));
      background = validateBackground(formString(formData, "background"));
      moderation = validateModeration(formString(formData, "moderation"));
      inputImages = await uploadedImages(formData);
    } else {
      const body = await request.json();
      prompt = validatePrompt(body.prompt);
      size = validateSize(body.size);
      quality = validateQuality(body.quality);
      outputFormat = validateOutputFormat(body.output_format ?? body.outputFormat);
      outputCompression = validateOutputCompression(outputFormat, body.output_compression ?? body.outputCompression);
      background = validateBackground(body.background);
      moderation = validateModeration(body.moderation);
      inputImages = [];
    }

    const job = await createImageJob({ user, prompt, size, quality, outputFormat, outputCompression, background, moderation, inputImages });
    return jsonOk({ ...publicJob(job), message: "任务已创建" }, 201);
  } catch (error) {
    return jsonError(error);
  }
}
