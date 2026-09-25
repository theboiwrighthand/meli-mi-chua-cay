import { eq, sql } from "drizzle-orm";
import { getDb } from "../../../../db";
import { orderItems, orders } from "../../../../db/schema";
import { isAdminRequest } from "../../../../lib/admin";

export async function GET() {
  if (!(await isAdminRequest())) return Response.json({ error: "Không có quyền truy cập" }, { status: 401 });

  try {
    const db = getDb();
    const [summary] = await db.select({
      unpaidCount: sql<number>`count(*) filter (where ${orders.status} not in ('paid', 'cancelled'))::int`,
      paidCount: sql<number>`count(*) filter (where ${orders.status} = 'paid')::int`,
      totalRevenue: sql<number>`coalesce(sum(${orders.total}) filter (where ${orders.status} = 'paid'), 0)::bigint`,
    }).from(orders);

    const items = await db.select({
      name: orderItems.itemName,
      quantity: sql<number>`coalesce(sum(${orderItems.quantity}) filter (where ${orders.status} <> 'cancelled'), 0)::bigint`,
      revenue: sql<number>`coalesce(sum(${orderItems.price} * ${orderItems.quantity}) filter (where ${orders.status} = 'paid'), 0)::bigint`,
    }).from(orderItems).innerJoin(orders, eq(orderItems.orderId, orders.id)).groupBy(orderItems.itemName);

    return Response.json({
      unpaidCount: Number(summary.unpaidCount),
      paidCount: Number(summary.paidCount),
      totalRevenue: Number(summary.totalRevenue),
      revenueByItem: items.map((item) => ({ name: item.name, value: Number(item.revenue) })).filter((item) => item.value > 0).sort((a, b) => b.value - a.value),
      quantityByItem: items.map((item) => ({ name: item.name, value: Number(item.quantity) })).filter((item) => item.value > 0).sort((a, b) => b.value - a.value),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("GET /api/admin/stats", error);
    return Response.json({ error: "Không thể tải thống kê" }, { status: 500 });
  }
}
