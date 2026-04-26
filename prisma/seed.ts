import "dotenv/config";
import crypto from "node:crypto";
import { PrismaClient, UserRole } from "@prisma/client";
import { hashPassword } from "../lib/password";

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
    const adminId = crypto.randomUUID();
    const passwordHash = await hashPassword(password);
    await prisma.user.create({
      data: {
        id: adminId,
        name: email,
        email,
        emailVerified: true,
        role: UserRole.ADMIN,
        dailyQuota: 9999,
        accounts: {
          create: {
            accountId: adminId,
            providerId: "credential",
            password: passwordHash
          }
        }
      }
    });
    console.log(`Created admin user: ${email}`);
  } else {
    if (process.env.ADMIN_RESET_PASSWORD === "true") {
      const passwordHash = await hashPassword(password);
      await prisma.user.update({
        where: { id: existingAdmin.id },
        data: { role: UserRole.ADMIN, isDisabled: false, emailVerified: true }
      });
      await prisma.account.upsert({
        where: {
          providerId_accountId: {
            providerId: "credential",
            accountId: existingAdmin.id
          }
        },
        create: {
          userId: existingAdmin.id,
          providerId: "credential",
          accountId: existingAdmin.id,
          password: passwordHash
        },
        update: {
          password: passwordHash
        }
      });
      console.log(`Reset admin password: ${email}`);
    } else {
      const account = await prisma.account.findUnique({
        where: {
          providerId_accountId: {
            providerId: "credential",
            accountId: existingAdmin.id
          }
        }
      });
      if (!account) {
        await prisma.account.create({
          data: {
            userId: existingAdmin.id,
            providerId: "credential",
            accountId: existingAdmin.id,
            password: await hashPassword(password)
          }
        });
        console.log(`Created missing admin credential account: ${email}`);
      }
      console.log(`Admin user already exists: ${email}`);
    }
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
