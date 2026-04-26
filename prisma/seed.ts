import "dotenv/config";
import crypto from "node:crypto";
import argon2 from "argon2";
import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

function inviteCode() {
  return crypto.randomBytes(9).toString("base64url").toUpperCase();
}

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required for seed.");
  }

  const existingAdmin = await prisma.user.findUnique({ where: { email } });
  if (!existingAdmin) {
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: UserRole.ADMIN,
        dailyQuota: 9999
      }
    });
    console.log(`Created admin user: ${email}`);
  } else {
    console.log(`Admin user already exists: ${email}`);
  }

  const now = new Date();
  const availableCodes = await prisma.inviteCode.count({
    where: {
      usedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
    }
  });

  for (let i = availableCodes; i < 5; i += 1) {
    const code = inviteCode();
    await prisma.inviteCode.create({ data: { code } });
    console.log(`Created invite code: ${code}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
