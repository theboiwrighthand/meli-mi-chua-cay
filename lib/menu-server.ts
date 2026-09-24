import { sql } from "drizzle-orm";
import { getDb } from "../db";
import type { MenuItem } from "./menu";

export async function getActiveMenu(): Promise<MenuItem[]> {
  const rows = await getDb().execute(sql`
    SELECT id, name, price, description, category
    FROM public.menu_items
    WHERE is_active = true
    ORDER BY sort_order ASC, id ASC
  `);

  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    price: Number(row.price),
    description: String(row.description ?? ""),
    category: row.category as MenuItem["category"],
  }));
}
