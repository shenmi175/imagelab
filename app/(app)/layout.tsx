import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { AppShell } from "@/components/app/AppShell";
import { currentUser, publicUser } from "@/lib/auth";
import { remainingQuota } from "@/lib/jobs";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role === UserRole.ADMIN) redirect("/admin");

  const quota = await remainingQuota(user).catch(() => undefined);

  return (
    <AppShell initialUser={publicUser(user)} initialRemainingQuota={quota}>
      {children}
    </AppShell>
  );
}
