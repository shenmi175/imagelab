import { UserRole } from "@prisma/client";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { hashPassword, verifyPassword } from "@/lib/password";

const secureCookies = env.appUrl.startsWith("https://");

export const auth = betterAuth({
  appName: "GPT Image Experience Site",
  baseURL: env.appUrl,
  secret: env.sessionSecret,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
    transaction: true
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    password: {
      hash: hashPassword,
      verify: ({ hash, password }) => verifyPassword(hash, password)
    }
  },
  session: {
    expiresIn: env.sessionTtlDays * 24 * 60 * 60,
    updateAge: 24 * 60 * 60
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: UserRole.USER,
        input: false
      },
      dailyQuota: {
        type: "number",
        defaultValue: env.defaultDailyQuota,
        input: false
      },
      isDisabled: {
        type: "boolean",
        defaultValue: false,
        input: false
      }
    }
  },
  trustedOrigins: [env.appUrl, "http://localhost:3005", "http://127.0.0.1:3005"],
  advanced: {
    cookiePrefix: "image_site",
    useSecureCookies: secureCookies,
    defaultCookieAttributes: {
      secure: secureCookies,
      sameSite: "lax"
    }
  }
});
