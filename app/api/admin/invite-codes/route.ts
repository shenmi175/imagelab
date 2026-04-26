import crypto from "node:crypto";
import { requireAdmin } from "@/lib/auth";
import { verifyCsrf } from "@/lib/csrf";
import { assertSameOrigin, jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function makeCode() {
  return crypto.randomBytes(9).toString("base64url").toUpperCase();
}

export async function GET() {
  try {
    await requireAdmin();
    const codes = await prisma.inviteCode.findMany({
      orderBy: { createdAt: "desc" },
      take: 100
    });
    return jsonOk({ items: codes });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    await assertSameOrigin();
    await verifyCsrf(request);
    const admin = await requireAdmin();
    const body = await request.json().catch(() => ({}));
    const count = typeof body.count === "number" && body.count > 0 ? Math.min(Math.floor(body.count), 20) : 1;
    const items = [];

    for (let i = 0; i < count; i += 1) {
      items.push(await prisma.inviteCode.create({ data: { code: makeCode(), createdById: admin.id } }));
    }

    return jsonOk({ items }, 201);
  } catch (error) {
    return jsonError(error);
  }
}
