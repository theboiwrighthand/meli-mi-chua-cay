import { createClient } from "@/lib/supabase/server";

export const OWNER_EMAIL = process.env.ADMIN_EMAIL ?? "bczzpnrs8b@privaterelay.appleid.com";

export async function isAdminRequest() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.email?.toLowerCase() === OWNER_EMAIL.toLowerCase();
}
