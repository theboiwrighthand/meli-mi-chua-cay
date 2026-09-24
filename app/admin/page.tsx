import Link from "next/link";
import { requireAppUser } from "../chatgpt-auth";
import { OWNER_EMAIL } from "@/lib/admin";
import { AdminDashboard } from "./admin-dashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireAppUser("/admin");
  if (user.email.toLowerCase() !== OWNER_EMAIL) return <main className="grid min-h-screen place-items-center bg-[#fff7eb] p-6"><div className="max-w-md rounded-3xl bg-white p-8 text-center shadow-xl"><h1 className="text-2xl font-black">Không có quyền truy cập</h1><p className="mt-2 text-zinc-600">Trang này chỉ dành cho chủ quán MELI.</p><Link className="mt-5 inline-block font-bold text-[#a82d1e]" href="/">Quay lại menu</Link></div></main>;
  return <AdminDashboard ownerName={user.fullName ?? "Chủ quán"} />;
}
