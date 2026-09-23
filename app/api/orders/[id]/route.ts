import { eq, sql } from "drizzle-orm";
import { getDb } from "../../../../db";
import { orders } from "../../../../db/schema";
import { isAdminRequest } from "../../../../lib/admin";

const allowedStatuses = new Set(["new", "cooking", "served", "paid", "cancelled"]);

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return Response.json({ error: "Không có quyền truy cập" }, { status: 401 });
  const { id } = await context.params;
  const payload = await request.json() as { status?: string };
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) || !allowedStatuses.has(payload.status ?? "")) return Response.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  try {
    const db = getDb();
    const [updated] = await db.update(orders).set({ status: payload.status!, paymentStatus: payload.status === "paid" ? "paid" : undefined, updatedAt: sql`now()` }).where(eq(orders.id, id)).returning();
    return updated ? Response.json({ order: updated }) : Response.json({ error: "Không tìm thấy đơn" }, { status: 404 });
  } catch (error) {
    console.error("PATCH /api/orders", error);
    return Response.json({ error: "Không thể cập nhật đơn" }, { status: 500 });
  }
}
