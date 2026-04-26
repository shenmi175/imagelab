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

export type StoredInputImage = {
  path: string;
  mime: string;
  name: string;
  bytes: number;
};

export function assertPng(buffer: Buffer) {
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new Error("Generated image is too large.");
  }
  if (buffer.length < PNG_MAGIC.length || !buffer.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC)) {
    throw new Error("Generated image is not a valid PNG.");
  }
}

function detectInputImage(buffer: Buffer, mime?: string) {
  if (buffer.length > MAX_INPUT_IMAGE_BYTES) {
    throw new ApiError("INVALID_INPUT", "上传图片不能超过 20MB");
  }

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

  if (mime && ["image/png", "image/jpeg", "image/webp"].includes(mime)) {
    throw new ApiError("INVALID_INPUT", "上传图片内容和 MIME 类型不匹配");
  }

  throw new ApiError("INVALID_INPUT", "仅支持 PNG、JPG、WEBP 图片上传");
}

export function assertSafeStoragePath(filePath: string) {
  const root = path.resolve(env.imageStorageDir);
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(`${root}${path.sep}`)) {
    throw new ApiError("FORBIDDEN", "文件路径无效", 403);
  }
  return resolved;
}

export async function saveImageFile(jobId: string, buffer: Buffer, format = "png") {
  assertPng(buffer);
  const date = new Date().toISOString().slice(0, 10);
  const dir = path.join(env.imageStorageDir, date);
  await fs.mkdir(dir, { recursive: true });

  const finalPath = path.join(dir, `${jobId}.${format}`);
  const tmpPath = `${finalPath}.${process.pid}.tmp`;
  await fs.writeFile(tmpPath, buffer, { flag: "wx" });
  await fs.rename(tmpPath, finalPath);
  return finalPath;
}

export async function saveThumbnailFile(jobId: string, buffer: Buffer) {
  assertPng(buffer);
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
  const detected = detectInputImage(input.buffer, input.mime);
  const date = new Date().toISOString().slice(0, 10);
  const dir = path.join(env.imageStorageDir, date, input.jobId, "input");
  await fs.mkdir(dir, { recursive: true });

  const baseName = input.name ? path.parse(input.name).name : `input-${input.index}`;
  const safeName = baseName.replace(/[^\w.-]+/g, "_").slice(0, 80) || `input-${input.index}`;
  const finalPath = path.join(dir, `${input.index}-${safeName}.${detected.ext}`);
  const tmpPath = `${finalPath}.${process.pid}.tmp`;
  await fs.writeFile(tmpPath, input.buffer, { flag: "wx" });
  await fs.rename(tmpPath, finalPath);

  return {
    path: finalPath,
    mime: detected.mime,
    name: safeName,
    bytes: input.buffer.length
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
