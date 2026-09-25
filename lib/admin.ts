import { createClient } from "@/lib/supabase/server";

export const OWNER_EMAIL = process.env.ADMIN_EMAIL ?? "bczzpnrs8b@privaterelay.appleid.com";

export async function isAdminRequest() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const email = user?.email?.toLowerCase();
  if (!email) return false;
  if (email === OWNER_EMAIL.toLowerCase()) return true;

  // Only the database administrator can add rows; authenticated users can read their own row.
  const { data, error } = await supabase.from("admin_users").select("email").eq("email", email).maybeSingle();
  return !error && data?.email === email;
}
