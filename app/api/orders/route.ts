import { desc, inArray } from "drizzle-orm";
import { getDb } from "../../../db";
import { orderItems, orders } from "../../../db/schema";
import { isAdminRequest } from "../../../lib/admin";
import { menu } from "../../../lib/menu";

type IncomingItem = { id?: string; quantity?: number; notes?: string[] };

export async function GET() {
  if (!(await isAdminRequest())) return Response.json({ error: "Không có quyền truy cập" }, { status: 401 });
  try {
    const db = getDb();
    const rows = await db.select().from(orders).orderBy(desc(orders.createdAt), desc(orders.id)).limit(100);
    const ids = rows.map((row) => row.id);
    const items = ids.length ? await db.select().from(orderItems).where(inArray(orderItems.orderId, ids)) : [];
    return Response.json({ orders: rows.map((row) => ({ ...row, items: items.filter((item) => item.orderId === row.id) })) });
  } catch (error) {
    console.error("GET /api/orders", error);
    return Response.json({ error: "Không thể tải đơn hàng" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { tableCode?: string; orderType?: string; source?: string; customerName?: string; note?: string; items?: IncomingItem[] };
    const source = payload.source === "staff_pos" ? "staff_pos" : "customer_qr";
    if (source === "staff_pos" && !(await isAdminRequest())) return Response.json({ error: "Không có quyền tạo đơn nhân viên" }, { status: 401 });
    const selected = (payload.items ?? []).map((incoming) => {
      const found = menu.find((item) => item.id === incoming.id);
      const quantity = Math.max(1, Math.min(20, Math.floor(incoming.quantity ?? 1)));
      return found ? { ...found, quantity, notes: (incoming.notes ?? []).slice(0, 8).join(", ") } : null;
    }).filter((item): item is NonNullable<typeof item> => Boolean(item));
    if (!selected.length) return Response.json({ error: "Đơn hàng chưa có món" }, { status: 400 });
    const total = selected.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const code = `ME${Date.now().toString(36).toUpperCase().slice(-6)}`;
    const db = getDb();
    const [created] = await db.insert(orders).values({
      code,
      tableCode: payload.tableCode?.trim().slice(0, 20) || null,
      orderType: payload.orderType === "takeaway" ? "takeaway" : "dine_in",
      source,
      customerName: payload.customerName?.trim().slice(0, 80) ?? "",
      note: payload.note?.trim().slice(0, 500) ?? "",
      total,
    }).returning();
    await db.insert(orderItems).values(selected.map((item) => ({ orderId: created.id, itemName: item.name, price: item.price, quantity: item.quantity, notes: item.notes })));
    return Response.json({ order: created }, { status: 201 });
  } catch (error) {
    console.error("POST /api/orders", error);
    return Response.json({ error: "Không thể tạo đơn. Vui lòng thử lại." }, { status: 500 });
  }
}
