import fs from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";
import { ApiError } from "@/lib/http";

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_IMAGE_BYTES = 50 * 1024 * 1024;

export function assertPng(buffer: Buffer) {
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new Error("Generated image is too large.");
  }
  if (buffer.length < PNG_MAGIC.length || !buffer.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC)) {
    throw new Error("Generated image is not a valid PNG.");
  }
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
