import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  redirect(user.role === UserRole.ADMIN ? "/admin" : "/generate");
}
