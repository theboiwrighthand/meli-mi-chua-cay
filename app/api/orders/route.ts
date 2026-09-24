import { desc, inArray, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { orderItems, orders } from "../../../db/schema";
import { isAdminRequest } from "../../../lib/admin";
import { getActiveMenu } from "../../../lib/menu-server";

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
    const menu = await getActiveMenu();
    const selected = (payload.items ?? []).map((incoming) => {
      const found = menu.find((item) => item.id === incoming.id);
      const quantity = Math.max(1, Math.min(20, Math.floor(incoming.quantity ?? 1)));
      return found ? { ...found, quantity, notes: (incoming.notes ?? []).slice(0, 8).join(", ") } : null;
    }).filter((item): item is NonNullable<typeof item> => Boolean(item));
    if (!selected.length) return Response.json({ error: "Đơn hàng chưa có món" }, { status: 400 });
    const total = selected.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const code = `ME${Date.now().toString(36).toUpperCase().slice(-6)}`;
    const isTakeaway = payload.orderType === "takeaway";
    const db = getDb();
    const [created] = await db.insert(orders).values({
      code,
      tableCode: isTakeaway ? null : payload.tableCode?.trim().slice(0, 20) || null,
      orderType: isTakeaway ? "takeaway" : "dine_in",
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

const orderIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request) {
  if (!(await isAdminRequest())) return Response.json({ error: "Không có quyền truy cập" }, { status: 401 });
  const payload = await request.json().catch(() => null) as { ids?: unknown; status?: unknown; confirmUnpay?: unknown } | null;
  if (!payload || !Array.isArray(payload.ids) || payload.ids.length < 1 || payload.ids.length > 100
    || !payload.ids.every((id) => typeof id === "string" && orderIdPattern.test(id))
    || !["new", "cooking", "paid"].includes(String(payload.status))) {
    return Response.json({ error: "Danh sách đơn hoặc trạng thái không hợp lệ" }, { status: 400 });
  }

  const ids = [...new Set(payload.ids as string[])];
  const target = payload.status as string;
  try {
    const result = await getDb().transaction(async (tx) => {
      const locked = await tx.execute(sql`SELECT id, status FROM public.orders WHERE id IN (${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)}) ORDER BY id FOR UPDATE`);
      if (locked.length !== ids.length) return { error: "Có đơn không còn tồn tại, hãy tải lại danh sách", status: 404 } as const;

      const allowed = locked.every((row) => {
        const current = String(row.status);
        return current === "new" && target === "cooking"
          || (current === "cooking" || current === "served") && (target === "new" || target === "paid")
          || current === "paid" && target === "cooking" && payload.confirmUnpay === true;
      });
      if (!allowed) return { error: "Có đơn đã đổi trạng thái, hãy tải lại danh sách", status: 409 } as const;

      const updated = await tx.update(orders).set({
        status: target,
        paymentStatus: target === "paid" ? "paid" : "unpaid",
        updatedAt: sql`now()`,
      }).where(inArray(orders.id, ids)).returning({ id: orders.id });
      return { updatedIds: updated.map((row) => row.id) };
    });
    return "error" in result
      ? Response.json({ error: result.error }, { status: result.status })
      : Response.json(result);
  } catch (error) {
    console.error("PATCH /api/orders", error);
    return Response.json({ error: "Không thể cập nhật các đơn đã chọn" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!(await isAdminRequest())) return Response.json({ error: "Không có quyền truy cập" }, { status: 401 });
  const payload = await request.json().catch(() => null) as { ids?: unknown; confirm?: unknown } | null;
  if (payload?.confirm !== true) return Response.json({ error: "Cần xác nhận trước khi xóa đơn" }, { status: 400 });
  if (!Array.isArray(payload.ids) || payload.ids.length < 1 || payload.ids.length > 100 || !payload.ids.every((id) => typeof id === "string" && orderIdPattern.test(id))) {
    return Response.json({ error: "Danh sách mã đơn không hợp lệ" }, { status: 400 });
  }
  const ids = [...new Set(payload.ids as string[])];
  try {
    const deleted = await getDb().delete(orders).where(inArray(orders.id, ids)).returning({ id: orders.id });
    return Response.json({ deletedIds: deleted.map((row) => row.id) });
  } catch (error) {
    console.error("DELETE /api/orders", error);
    return Response.json({ error: "Không thể xóa đơn hàng" }, { status: 500 });
  }
}
