import { CustomerOrder } from "./customer-order";
import { getActiveMenu } from "@/lib/menu-server";
import { isAdminRequest } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ table?: string | string[] }>;
}) {
  const table = (await searchParams).table;
  const initialTableCode = (Array.isArray(table) ? table[0] : table)?.trim().slice(0, 20) ?? "";

  const [menu, isAdmin] = await Promise.all([getActiveMenu(), isAdminRequest()]);
  return <CustomerOrder initialTableCode={initialTableCode} menu={menu} isAdmin={isAdmin} />;
}
