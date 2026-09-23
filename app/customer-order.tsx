"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Minus, Plus, ReceiptText, Store, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney, menu, type MenuItem } from "@/lib/menu";

type CartLine = MenuItem & { quantity: number };
const groups = [{ id: "mains", title: "Mì chua cay", icon: "🍜" }, { id: "extras", title: "Ăn kèm", icon: "🥢" }, { id: "drinks", title: "Đồ uống", icon: "🥤" }] as const;
const quickNotes = ["Ít cay", "Không hành", "Không giá"];

export function CustomerOrder() {
  const [tableCode, setTableCode] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("table") ?? "");
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [notes, setNotes] = useState<string[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [otherNote, setOtherNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ code: string; total: number } | null>(null);
  const [error, setError] = useState("");
  const lines = Object.values(cart);
  const total = useMemo(() => lines.reduce((sum, line) => sum + line.price * line.quantity, 0), [lines]);

  function change(item: MenuItem, delta: number) { setCart((current) => { const quantity = (current[item.id]?.quantity ?? 0) + delta; const next = { ...current }; if (quantity <= 0) delete next[item.id]; else next[item.id] = { ...item, quantity }; return next; }); }
  async function submit() {
    setSubmitting(true); setError("");
    try {
      const response = await fetch("/api/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tableCode, orderType: tableCode ? "dine_in" : "takeaway", customerName, note: [...notes, otherNote].filter(Boolean).join(", "), items: lines.map((line) => ({ id: line.id, quantity: line.quantity, notes })) }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Không thể gửi đơn"); setSuccess({ code: result.order.code, total: result.order.total }); setCart({});
    } catch (err) { setError(err instanceof Error ? err.message : "Không thể gửi đơn"); } finally { setSubmitting(false); }
  }

  if (success) return <main className="min-h-screen bg-[#fff8ea] px-4 py-12 text-[#173124]"><section className="mx-auto max-w-md rounded-[28px] border border-[#dce8dd] bg-white p-8 text-center shadow-xl"><div className="mx-auto mb-5 grid size-16 place-items-center rounded-full bg-[#e0f4e5] text-3xl">✓</div><p className="text-sm font-bold uppercase tracking-widest text-[#0b6b3d]">Đã gửi tới quán</p><h1 className="mt-2 text-3xl font-black">Đơn {success.code}</h1><p className="mt-3 text-[#66746b]">{tableCode ? `Bàn ${tableCode} · ` : "Mang về · "}{formatMoney(success.total)}</p><p className="mt-6 rounded-2xl bg-[#fff3e8] p-4 text-sm">Quán đã nhận được đơn. Bạn vui lòng chờ nhân viên chuẩn bị món.</p><Button className="mt-6 w-full bg-[#07572f]" onClick={() => setSuccess(null)}>Gọi thêm món</Button></section></main>;

  return <main className="min-h-screen bg-[#fff8ea] text-[#173124]"><header className="sticky top-0 z-20 border-b border-[#e7e1d5] bg-[#fff8ea]/95 backdrop-blur"><div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3"><div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-2xl bg-[#ff6b24] text-xl font-black text-white">M</div><div><div className="font-black tracking-[.12em] text-[#07572f]">MELI</div><div className="text-xs text-[#6a756d]">Mì chua cay · Nghĩa Tân</div></div></div><div className="flex items-center gap-2">{tableCode && <span className="rounded-full bg-[#e2f0e5] px-3 py-2 text-sm font-bold text-[#07572f]">Bàn {tableCode}</span>}<Link href="/admin" className="rounded-xl border border-[#d7ded8] bg-white p-2.5" aria-label="Quản lý"><Store className="size-5" /></Link></div></div></header><div className="mx-auto grid max-w-6xl gap-7 px-4 py-6 lg:grid-cols-[1fr_360px]">
    <section><div className="mb-7 overflow-hidden rounded-[28px] bg-[#07572f] p-7 text-white sm:grid sm:grid-cols-[1fr_250px] sm:items-center sm:gap-6"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#ffaf7a]">Nóng hổi · Đậm vị</p><h1 className="mt-2 text-4xl font-black leading-none sm:text-5xl">Chọn món bạn thích.</h1><p className="mt-3 text-sm text-[#d7eadf]">Đơn được gửi thẳng tới quầy và lưu theo bàn.</p></div><Image src="/menu.jpeg" alt="Menu MELI" width={640} height={360} className="mt-5 h-36 w-full rounded-2xl object-cover shadow-2xl sm:mt-0" /></div>{groups.map((group) => <div key={group.id} className="mb-8"><h2 className="mb-3 text-2xl font-black">{group.title}</h2><div className="grid gap-3 sm:grid-cols-2">{menu.filter((item) => item.category === group.id).map((item) => <article key={item.id} className="flex items-center gap-3 rounded-2xl border border-[#e1e5df] bg-white p-4"><div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#fff0e6] text-2xl">{group.icon}</div><div className="min-w-0 flex-1"><h3 className="font-extrabold">{item.name}</h3><p className="truncate text-xs text-[#758079]">{item.description || "Giải khát"}</p><p className="mt-1 font-black text-[#e85c1c]">{formatMoney(item.price)}</p></div><Button size="icon" className="rounded-xl bg-[#07572f]" onClick={() => change(item, 1)} aria-label={`Thêm ${item.name}`}><Plus /></Button></article>)}</div></div>)}</section>
    <aside className="h-max rounded-[26px] border border-[#dfe4df] bg-white p-5 shadow-xl lg:sticky lg:top-20"><div className="flex items-center gap-2"><ReceiptText className="text-[#07572f]"/><h2 className="text-2xl font-black">Đơn của bạn</h2></div>{!lines.length ? <div className="my-5 rounded-2xl border border-dashed border-[#ccd6ce] p-8 text-center text-sm text-[#748078]"><UtensilsCrossed className="mx-auto mb-3"/>Chưa có món nào</div> : <div className="my-4 divide-y">{lines.map((line) => <div key={line.id} className="flex items-center gap-2 py-3"><div className="min-w-0 flex-1"><div className="truncate font-bold">{line.name}</div><div className="text-sm text-[#e85c1c]">{formatMoney(line.price * line.quantity)}</div></div><Button variant="outline" size="icon-sm" onClick={() => change(line, -1)}><Minus /></Button><b>{line.quantity}</b><Button variant="outline" size="icon-sm" onClick={() => change(line, 1)}><Plus /></Button></div>)}</div>}<div className="flex justify-between border-t pt-4 text-xl font-black"><span>Tổng cộng</span><span>{formatMoney(total)}</span></div><div className="mt-5 space-y-3"><Input value={tableCode} onChange={(e) => setTableCode(e.target.value)} placeholder="Số bàn (ví dụ: 05)"/><Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Tên khách (không bắt buộc)"/><p className="text-sm font-bold">Yêu cầu cho món</p><div className="grid grid-cols-3 gap-2">{quickNotes.map((note) => <label key={note} className={`flex cursor-pointer items-center justify-center gap-1 rounded-xl border px-2 py-2.5 text-center text-xs font-bold ${notes.includes(note) ? "border-[#07572f] bg-[#e4f3e8] text-[#07572f]" : "bg-white"}`}><Checkbox checked={notes.includes(note)} onCheckedChange={(checked) => setNotes((current) => checked ? [...current, note] : current.filter((value) => value !== note))}/>{note}</label>)}</div><Textarea value={otherNote} onChange={(e) => setOtherNote(e.target.value)} placeholder="Ghi chú khác..." />{error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}<Button className="w-full bg-[#ff6b24] py-6 text-base font-black hover:bg-[#e85c1c]" disabled={!lines.length || submitting} onClick={submit}>{submitting ? "Đang gửi..." : "Gửi đơn cho quán"}</Button></div></aside>
  </div></main>;
}
