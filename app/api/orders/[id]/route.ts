import { eq, sql } from "drizzle-orm";
import { getDb } from "../../../../db";
import { orderItems, orders } from "../../../../db/schema";
import { isAdminRequest } from "../../../../lib/admin";

const orderIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const allowedStatuses = new Set(["new", "cooking", "served", "paid", "cancelled"]);

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return Response.json({ error: "Không có quyền truy cập" }, { status: 401 });
  const { id } = await context.params;
  const payload = await request.json() as { status?: string };
  if (!orderIdPattern.test(id) || !allowedStatuses.has(payload.status ?? "")) return Response.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  try {
    const db = getDb();
    const [updated] = await db.update(orders).set({ status: payload.status!, paymentStatus: payload.status === "paid" ? "paid" : undefined, updatedAt: sql`now()` }).where(eq(orders.id, id)).returning();
    return updated ? Response.json({ order: updated }) : Response.json({ error: "Không tìm thấy đơn" }, { status: 404 });
  } catch (error) {
    console.error("PATCH /api/orders", error);
    return Response.json({ error: "Không thể cập nhật đơn" }, { status: 500 });
  }
}


type EditedItem = { id?: number; menuItemId?: string; quantity: number };
type EditPayload = { tableCode: string; customerName: string; note: string; items: EditedItem[] };

class OrderEditError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return Response.json({ error: "Không có quyền truy cập" }, { status: 401 });
  const { id } = await context.params;
  if (!orderIdPattern.test(id)) return Response.json({ error: "Mã đơn không hợp lệ" }, { status: 400 });

  const payload = await request.json().catch(() => null) as EditPayload | null;
  if (!payload || typeof payload.tableCode !== "string" || payload.tableCode.length > 20
    || typeof payload.customerName !== "string" || payload.customerName.length > 80
    || typeof payload.note !== "string" || payload.note.length > 500
    || !Array.isArray(payload.items) || payload.items.length < 1 || payload.items.length > 50) {
    return Response.json({ error: "Dữ liệu đơn hàng không hợp lệ" }, { status: 400 });
  }

  const identities = new Set<string>();
  for (const item of payload.items) {
    if (!item || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20) {
      return Response.json({ error: "Số lượng món phải từ 1 đến 20" }, { status: 400 });
    }
    const existing = Number.isSafeInteger(item.id) && (item.id ?? 0) > 0 && item.menuItemId === undefined;
    const added = typeof item.menuItemId === "string" && item.menuItemId.length > 0 && item.menuItemId.length <= 128 && item.id === undefined;
    if (!existing && !added) return Response.json({ error: "Món trong đơn không hợp lệ" }, { status: 400 });
    const identity = existing ? `existing:${item.id}` : `menu:${item.menuItemId}`;
    if (identities.has(identity)) return Response.json({ error: "Món bị lặp trong đơn" }, { status: 400 });
    identities.add(identity);
  }

  try {
    const result = await getDb().transaction(async (tx) => {
      const locked = await tx.execute(sql`SELECT status, payment_status FROM public.orders WHERE id = ${id}::uuid FOR UPDATE`);
      if (!locked.length) throw new OrderEditError("Không tìm thấy đơn", 404);
      if (!["new", "cooking", "served"].includes(String(locked[0].status)) || locked[0].payment_status === "paid") {
        throw new OrderEditError("Đơn đã hoàn thành hoặc đã hủy, không thể chỉnh sửa", 409);
      }

      const existingItems = await tx.select().from(orderItems).where(eq(orderItems.orderId, id));
      const existingById = new Map(existingItems.map((item) => [item.id, item]));
      const menuRows = await tx.execute(sql`SELECT id, name, price FROM public.menu_items WHERE is_active = true`);
      const activeMenu = new Map(menuRows.map((item) => [String(item.id), item]));
      const lines = payload.items.map((item) => {
        if (item.id !== undefined) {
          const previous = existingById.get(item.id);
          if (!previous) throw new OrderEditError("Món này không còn thuộc đơn, hãy tải lại trang", 409);
          return { orderId: id, menuItemId: previous.menuItemId, itemName: previous.itemName, price: previous.price, quantity: item.quantity, notes: previous.notes };
        }
        const selected = activeMenu.get(item.menuItemId!);
        if (!selected) throw new OrderEditError("Món vừa chọn đã ngừng bán, hãy tải lại menu", 409);
        return { orderId: id, menuItemId: item.menuItemId!, itemName: String(selected.name), price: Number(selected.price), quantity: item.quantity, notes: "" };
      });
      const total = lines.reduce((sum, item) => sum + item.price * item.quantity, 0);
      if (!Number.isSafeInteger(total) || total > 2147483647) throw new OrderEditError("Tổng tiền không hợp lệ", 400);

      await tx.delete(orderItems).where(eq(orderItems.orderId, id));
      await tx.insert(orderItems).values(lines);
      const tableCode = payload.tableCode.trim();
      const [updated] = await tx.update(orders).set({
        tableCode: tableCode || null,
        orderType: tableCode ? "dine_in" : "takeaway",
        customerName: payload.customerName.trim(),
        note: payload.note.trim(),
        total,
        updatedAt: sql`now()`,
      }).where(eq(orders.id, id)).returning();
      return updated;
    });
    return Response.json({ order: result });
  } catch (error) {
    if (error instanceof OrderEditError) return Response.json({ error: error.message }, { status: error.status });
    console.error("PUT /api/orders/[id]", error);
    return Response.json({ error: "Không thể lưu thay đổi đơn hàng" }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return Response.json({ error: "Không có quyền truy cập" }, { status: 401 });
  const { id } = await context.params;
  if (!orderIdPattern.test(id)) return Response.json({ error: "Mã đơn không hợp lệ" }, { status: 400 });
  const payload = await request.json().catch(() => null) as { confirm?: unknown } | null;
  if (payload?.confirm !== true) return Response.json({ error: "Cần xác nhận trước khi xóa đơn" }, { status: 400 });

  try {
    const [deleted] = await getDb().delete(orders).where(eq(orders.id, id)).returning({ id: orders.id });
    return deleted
      ? Response.json({ deletedId: deleted.id })
      : Response.json({ error: "Không tìm thấy đơn" }, { status: 404 });
  } catch (error) {
    console.error("DELETE /api/orders/[id]", error);
    return Response.json({ error: "Không thể xóa đơn" }, { status: 500 });
  }
}
