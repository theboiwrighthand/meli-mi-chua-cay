import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type AppUser = { userId: string; displayName: string; email: string; fullName: string | null };

export async function getAppUser(): Promise<AppUser | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const fullName = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null;
  return { userId: user.id, displayName: fullName ?? user.email, email: user.email, fullName };
}

export async function requireAppUser(returnTo: string): Promise<AppUser> {
  const user = await getAppUser();
  if (user) return user;
  const safeReturnTo = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/admin";
  redirect(`/login?returnTo=${encodeURIComponent(safeReturnTo)}`);
}
