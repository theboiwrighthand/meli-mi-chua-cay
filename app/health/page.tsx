import { sql } from "drizzle-orm";
import { getDb } from "../../db";

export const dynamic = "force-dynamic";

export default async function HealthPage() {
  let healthy = false;

  try {
    await getDb().execute(sql`SELECT 1 FROM public.orders LIMIT 1`);
    healthy = true;
  } catch (error) {
    console.error("GET /health", error);
  }

  return (
    <main style={{ maxWidth: 640, margin: "6rem auto", padding: "0 1.5rem", fontFamily: "sans-serif" }}>
      <h1>Trạng thái MELI</h1>
      <p>{healthy ? "Kết nối cơ sở dữ liệu thành công." : "Không thể kết nối cơ sở dữ liệu."}</p>
    </main>
  );
}
