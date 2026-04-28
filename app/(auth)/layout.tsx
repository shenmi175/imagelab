import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { AuthShell } from "@/components/auth/AuthShell";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (user) redirect(user.role === UserRole.ADMIN ? "/admin" : "/generate");

  return <AuthShell>{children}</AuthShell>;
}
