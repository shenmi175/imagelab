import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { env } from "@/lib/env";
import { ApiError } from "@/lib/http";

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);
const WEBP_RIFF = Buffer.from("RIFF");
const WEBP_WEBP = Buffer.from("WEBP");
const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
const MAX_INPUT_IMAGE_BYTES = 20 * 1024 * 1024;
const MIN_UPSTREAM_INPUT_IMAGE_EDGE = 640;
const MIN_UPSTREAM_INPUT_IMAGE_QUALITY = 52;

export type StoredInputImage = {
  path: string;
  mime: string;
  name: string;
  bytes: number;
};

export type StoredGeneratedImage = {
  path: string;
  mime: string;
  ext: string;
};

function detectImage(buffer: Buffer) {
  if (buffer.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC)) {
    return { mime: "image/png", ext: "png" };
  }
  if (buffer.subarray(0, JPEG_MAGIC.length).equals(JPEG_MAGIC)) {
    return { mime: "image/jpeg", ext: "jpg" };
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).equals(WEBP_RIFF) &&
    buffer.subarray(8, 12).equals(WEBP_WEBP)
  ) {
    return { mime: "image/webp", ext: "webp" };
  }
  return null;
}

export function assertPng(buffer: Buffer) {
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new Error("生成结果文件过大。");
  }
  if (buffer.length < PNG_MAGIC.length || !buffer.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC)) {
    throw new Error("生成结果不是有效图片。");
  }
}

function detectGeneratedImage(buffer: Buffer) {
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new Error("生成结果文件过大。");
  }
  const detected = detectImage(buffer);
  if (!detected) {
    throw new Error("生成结果不是有效图片。");
  }
  return detected;
}

function detectInputImage(buffer: Buffer, mime?: string) {
  if (buffer.length > MAX_INPUT_IMAGE_BYTES) {
    throw new ApiError("INVALID_INPUT", "上传图片不能超过 20MB");
  }

  const detected = detectImage(buffer);
  if (detected) return detected;

  if (mime && ["image/png", "image/jpeg", "image/webp"].includes(mime)) {
    throw new ApiError("INVALID_INPUT", "上传图片内容和文件类型不匹配");
  }

  throw new ApiError("INVALID_INPUT", "仅支持常见图片格式上传");
}

async function encodeInputAsJpeg(buffer: Buffer, edge: number, quality: number) {
  return sharp(buffer, { failOn: "none" })
    .rotate()
    .resize({ width: edge, height: edge, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#fff" })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();
}

export async function optimizeInputImageForUpstream(buffer: Buffer, mime?: string) {
  const detected = detectInputImage(buffer, mime);
  const maxBytes = Math.max(256_000, env.upstreamInputImageMaxBytes);
  const maxEdge = Math.max(MIN_UPSTREAM_INPUT_IMAGE_EDGE, env.upstreamInputImageMaxEdge);
  const initialQuality = Math.min(92, Math.max(MIN_UPSTREAM_INPUT_IMAGE_QUALITY, env.upstreamInputImageQuality));
  const metadata = await sharp(buffer, { failOn: "none" }).metadata();
  const maxDimension = Math.max(metadata.width ?? 0, metadata.height ?? 0);

  if (buffer.length <= maxBytes && (!maxDimension || maxDimension <= maxEdge)) {
    return { buffer, mime: detected.mime, ext: detected.ext };
  }

  const startingEdge = Math.max(MIN_UPSTREAM_INPUT_IMAGE_EDGE, Math.min(maxDimension || maxEdge, maxEdge));
  const edgeAttempts = Array.from(
    new Set([startingEdge, 1280, 1024, 768, MIN_UPSTREAM_INPUT_IMAGE_EDGE].filter((edge) => edge <= startingEdge && edge >= MIN_UPSTREAM_INPUT_IMAGE_EDGE))
  );
  let best: Buffer | null = null;

  for (const edge of edgeAttempts) {
    for (let quality = initialQuality; quality >= MIN_UPSTREAM_INPUT_IMAGE_QUALITY; quality -= 8) {
      const optimized = await encodeInputAsJpeg(buffer, edge, quality);
      if (!best || optimized.length < best.length) best = optimized;
      if (optimized.length <= maxBytes) {
        return { buffer: optimized, mime: "image/jpeg", ext: "jpg" };
      }
    }
  }

  throw new ApiError("INVALID_INPUT", "参考图压缩后仍过大，请减少图片数量或降低图片分辨率");
}

export function assertSafeStoragePath(filePath: string) {
  const root = path.resolve(env.imageStorageDir);
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(`${root}${path.sep}`)) {
    throw new ApiError("FORBIDDEN", "文件路径无效", 403);
  }
  return resolved;
}

export async function saveImageFile(jobId: string, buffer: Buffer): Promise<StoredGeneratedImage> {
  const detected = detectGeneratedImage(buffer);
  const date = new Date().toISOString().slice(0, 10);
  const dir = path.join(env.imageStorageDir, date);
  await fs.mkdir(dir, { recursive: true });

  const finalPath = path.join(dir, `${jobId}.${detected.ext}`);
  const tmpPath = `${finalPath}.${process.pid}.tmp`;
  await fs.writeFile(tmpPath, buffer, { flag: "wx" });
  await fs.rename(tmpPath, finalPath);
  return {
    path: finalPath,
    mime: detected.mime,
    ext: detected.ext
  };
}

export async function saveThumbnailFile(jobId: string, buffer: Buffer) {
  detectGeneratedImage(buffer);
  const date = new Date().toISOString().slice(0, 10);
  const dir = path.join(env.imageStorageDir, date, "thumbs");
  await fs.mkdir(dir, { recursive: true });

  const thumbnail = await sharp(buffer)
    .resize({ width: 512, height: 512, fit: "inside", withoutEnlargement: true })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();

  assertPng(thumbnail);

  const finalPath = path.join(dir, `${jobId}.png`);
  const tmpPath = `${finalPath}.${process.pid}.tmp`;
  await fs.writeFile(tmpPath, thumbnail, { flag: "wx" });
  await fs.rename(tmpPath, finalPath);
  return {
    path: finalPath,
    mime: "image/png",
    bytes: thumbnail.length
  };
}

export async function saveInputImageFile(input: {
  jobId: string;
  index: number;
  buffer: Buffer;
  mime?: string;
  name?: string;
}) {
  const optimized = await optimizeInputImageForUpstream(input.buffer, input.mime);
  const date = new Date().toISOString().slice(0, 10);
  const dir = path.join(env.imageStorageDir, date, input.jobId, "input");
  await fs.mkdir(dir, { recursive: true });

  const baseName = input.name ? path.parse(input.name).name : `input-${input.index}`;
  const safeName = baseName.replace(/[^\w.-]+/g, "_").slice(0, 80) || `input-${input.index}`;
  const finalPath = path.join(dir, `${input.index}-${safeName}.${optimized.ext}`);
  const tmpPath = `${finalPath}.${process.pid}.tmp`;
  await fs.writeFile(tmpPath, optimized.buffer, { flag: "wx" });
  await fs.rename(tmpPath, finalPath);

  return {
    path: finalPath,
    mime: optimized.mime,
    name: `${safeName}.${optimized.ext}`,
    bytes: optimized.buffer.length
  } satisfies StoredInputImage;
}

export async function readImageFile(filePath: string) {
  const safePath = assertSafeStoragePath(filePath);
  try {
    return await fs.readFile(safePath);
  } catch {
    throw new ApiError("IMAGE_EXPIRED", "图片文件不存在或已过期", 404);
  }
}

export async function deleteImageFile(filePath: string | null) {
  if (!filePath) return;
  const safePath = assertSafeStoragePath(filePath);
  await fs.rm(safePath, { force: true });
}

export function parseStoredInputImages(value: unknown): StoredInputImage[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is StoredInputImage => {
    if (!item || typeof item !== "object") return false;
    const image = item as Partial<StoredInputImage>;
    return (
      typeof image.path === "string" &&
      typeof image.mime === "string" &&
      typeof image.name === "string" &&
      typeof image.bytes === "number"
    );
  });
}

export async function deleteInputImages(value: unknown) {
  await Promise.all(parseStoredInputImages(value).map((image) => deleteImageFile(image.path)));
}
