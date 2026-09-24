"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChefHat, CircleDollarSign, Clock3, Plus, RefreshCw, Store, Trash2, UtensilsCrossed, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney, menu } from "@/lib/menu";

type OrderItem = { id: number; itemName: string; price: number; quantity: number; notes: string };
type Order = { id: string; code: string; tableCode: string | null; orderType: string; source: string; status: string; customerName: string; note: string; total: number; paymentStatus: string; createdAt: string; items: OrderItem[] };
const columns = [
  { id: "new", title: "Đơn mới", icon: Clock3, action: "Bắt đầu làm", next: "cooking" },
  { id: "cooking", title: "Đang làm", icon: ChefHat, action: "Đã phục vụ", next: "served" },
  { id: "served", title: "Đã phục vụ", icon: UtensilsCrossed, action: "Đã thanh toán", next: "paid" },
  { id: "paid", title: "Hoàn thành", icon: CircleDollarSign, action: "", next: "" },
  { id: "cancelled", title: "Đã hủy", icon: XCircle, action: "", next: "" },
] as const;
const quickNotes = ["Ít cay", "Không hành", "Không giá"];


export function AdminDashboard({ ownerName }: { ownerName: string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<{ kind: "single" | "bulk"; ids: string[]; label: string } | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch("/api/orders", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setOrders(result.orders);
      const availableIds = new Set<string>(result.orders.map((order: Order) => order.id));
      setSelectedIds((current) => current.filter((id) => availableIds.has(id)));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải đơn");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = setTimeout(() => void load(), 0);
    const timer = setInterval(() => void load(true), 5000);
    return () => { clearTimeout(initial); clearInterval(timer); };
  }, [load]);

  async function updateStatus(id: string, status: string) {
    const response = await fetch(`/api/orders/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (response.ok) await load(true);
  }

  function requestDelete(kind: "single" | "bulk", ids: string[], label: string) {
    setDeleteError("");
    setDeleteTarget({ kind, ids, label });
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const response = await fetch(deleteTarget.kind === "single" ? `/api/orders/${deleteTarget.ids[0]}` : "/api/orders", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(deleteTarget.kind === "single" ? { confirm: true } : { ids: deleteTarget.ids, confirm: true }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Không thể xóa đơn hàng");
      const removedIds = new Set<string>(deleteTarget.kind === "single" ? [result.deletedId] : result.deletedIds);
      setOrders((current) => current.filter((order) => !removedIds.has(order.id)));
      setSelectedIds((current) => current.filter((id) => !removedIds.has(id)));
      setDeleteTarget(null);
      await load(true);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Không thể xóa đơn hàng");
    } finally {
      setDeleting(false);
    }
  }

  const activeCount = orders.filter((order) => !["paid", "cancelled"].includes(order.status)).length;
  const todayRevenue = orders.filter((order) => order.status === "paid").reduce((sum, order) => sum + order.total, 0);
  const visibleOrders = orders.filter((order) => columns.some((column) => column.id === order.status));
  const allSelected = visibleOrders.length > 0 && visibleOrders.every((order) => selectedIds.includes(order.id));

  return <main className="min-h-screen bg-[#fff7eb] text-[#2e201c]">
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-3 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-2xl bg-[#a82d1e] text-white"><Store /></div>
          <div><h1 className="font-black">MELI · Quản lý đơn</h1><p className="text-xs text-zinc-500">Xin chào, {ownerName}</p></div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => load()} aria-label="Làm mới"><RefreshCw /></Button>
          <Link href="/"><Button variant="outline">Menu khách</Button></Link>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="bg-[#bd3b22] hover:bg-[#9e281c]"><Plus /> Tạo đơn</Button></DialogTrigger>
            <CreateOrderDialog onCreated={() => { setOpen(false); load(true); }} />
          </Dialog>
        </div>
      </div>
    </header>
    <section className="mx-auto max-w-[1500px] px-4 py-6">
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Đơn đang mở" value={`${activeCount}`} />
        <Stat label="Đã thanh toán" value={`${orders.filter((o) => o.status === "paid").length} đơn`} />
        <Stat label="Doanh thu ghi nhận" value={formatMoney(todayRevenue)} />
      </div>
      {error && <p className="mb-5 rounded-2xl bg-red-50 p-4 text-red-700">{error}</p>}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
          <Checkbox checked={allSelected} disabled={!visibleOrders.length || deleting} onCheckedChange={(checked) => setSelectedIds(checked === true ? visibleOrders.map((order) => order.id) : [])} aria-label="Chọn tất cả đơn" />
          Chọn tất cả ({visibleOrders.length})
        </label>
        <div className="flex items-center gap-3">
          {selectedIds.length > 0 && <span className="text-sm text-zinc-600">Đã chọn {selectedIds.length} đơn</span>}
          <Button variant="destructive" size="sm" disabled={!selectedIds.length || deleting} onClick={() => requestDelete("bulk", selectedIds, `${selectedIds.length} đơn đã chọn`)}>
            <Trash2 className="size-4" /> Xóa đã chọn
          </Button>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-3 2xl:grid-cols-5">
        {columns.map((column) => {
          const Icon = column.icon;
          const list = orders.filter((order) => order.status === column.id);
          return <div key={column.id} className="min-h-64 rounded-3xl bg-[#eaede8] p-3">
            <div className="mb-3 flex items-center justify-between px-2">
              <h2 className="flex items-center gap-2 font-black"><Icon className="size-4" />{column.title}</h2>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black">{list.length}</span>
            </div>
            <div className="space-y-3">
              {loading && !orders.length ? <div className="rounded-2xl bg-white p-5 text-sm text-zinc-500">Đang tải...</div> : list.map((order) =>
                <article key={order.id} className="rounded-2xl bg-white p-4 shadow-sm">
                  <div className="flex justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-[#9e281c]">{order.code} · {order.source === "staff_pos" ? "Chủ quán tạo" : "Khách tự đặt"}</p>
                      <h3 className="text-lg font-black">{order.tableCode ? `Bàn ${order.tableCode}` : "Mang về"}</h3>
                    </div>
                    <div className="flex items-start gap-2">
                      <time className="text-xs text-zinc-500">{new Date(order.createdAt + "Z").toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</time>
                      <Checkbox checked={selectedIds.includes(order.id)} onCheckedChange={(checked) => setSelectedIds((current) => checked === true ? [...current, order.id] : current.filter((id) => id !== order.id))} aria-label={`Chọn đơn ${order.code}`} />
                    </div>
                  </div>
                  <div className="my-3 space-y-1 border-y py-3">{order.items.map((item) =>
                    <div key={item.id} className="flex justify-between text-sm"><span><b>{item.quantity}×</b> {item.itemName}</span><span>{formatMoney(item.price * item.quantity)}</span></div>
                  )}</div>
                  {order.note && <p className="mb-3 rounded-xl bg-[#fff0df] p-2 text-xs"><b>Ghi chú:</b> {order.note}</p>}
                  <div className="flex items-center justify-between gap-2">
                    <b>{formatMoney(order.total)}</b>
                    <div className="flex items-center gap-1">
                      {column.next && <Button size="sm" className="bg-[#a82d1e]" onClick={() => updateStatus(order.id, column.next)}>{column.action}</Button>}
                      <Button variant="ghost" size="icon-sm" className="text-red-700 hover:bg-red-50 hover:text-red-800" onClick={() => requestDelete("single", [order.id], `đơn ${order.code}`)} aria-label={`Xóa đơn ${order.code}`} title="Xóa đơn"><Trash2 className="size-4" /></Button>
                    </div>
                  </div>
                </article>
              )}
            </div>
          </div>;
        })}
      </div>
    </section>
    <Dialog open={deleteTarget !== null} onOpenChange={(next) => { if (!next && !deleting) { setDeleteTarget(null); setDeleteError(""); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Xóa {deleteTarget?.label}?</DialogTitle>
          <DialogDescription>Đơn và các món trong đơn sẽ bị xóa vĩnh viễn. Thao tác này không thể hoàn tác.</DialogDescription>
        </DialogHeader>
        {deleteError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{deleteError}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={deleting} onClick={() => { setDeleteTarget(null); setDeleteError(""); }}>Không, giữ lại</Button>
          <Button variant="destructive" disabled={deleting} onClick={confirmDelete}>{deleting ? "Đang xóa..." : "Xác nhận xóa"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  </main>;
}

function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border bg-white p-4"><p className="text-xs font-bold uppercase tracking-wider text-zinc-500">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>; }

function CreateOrderDialog({ onCreated }: { onCreated: () => void }) {
  const [tableCode, setTableCode] = useState(""); const [cart, setCart] = useState<Record<string, number>>({}); const [notes, setNotes] = useState<string[]>([]); const [otherNote, setOtherNote] = useState(""); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const selected = menu.filter((item) => cart[item.id]); const total = useMemo(() => selected.reduce((sum, item) => sum + item.price * cart[item.id], 0), [selected, cart]);
  async function create() { setSaving(true); setError(""); try { const response = await fetch("/api/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ source: "staff_pos", tableCode, orderType: tableCode ? "dine_in" : "takeaway", note: [...notes, otherNote].filter(Boolean).join(", "), items: selected.map((item) => ({ id: item.id, quantity: cart[item.id], notes })) }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error); onCreated(); } catch (err) { setError(err instanceof Error ? err.message : "Không thể tạo đơn"); } finally { setSaving(false); } }
  return <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle className="text-2xl">Tạo đơn tại quầy</DialogTitle></DialogHeader><Input value={tableCode} onChange={(e) => setTableCode(e.target.value)} placeholder="Số bàn — để trống nếu mang về"/><div className="grid gap-2 sm:grid-cols-2">{menu.map((item) => <div key={item.id} className="flex items-center gap-2 rounded-xl border p-3"><div className="min-w-0 flex-1"><p className="truncate font-bold">{item.name}</p><p className="text-sm text-[#9e281c]">{formatMoney(item.price)}</p></div><Button variant="outline" size="icon-sm" onClick={() => setCart((c) => ({ ...c, [item.id]: Math.max(0, (c[item.id] ?? 0) - 1) }))}>−</Button><b className="w-5 text-center">{cart[item.id] ?? 0}</b><Button variant="outline" size="icon-sm" onClick={() => setCart((c) => ({ ...c, [item.id]: (c[item.id] ?? 0) + 1 }))}>+</Button></div>)}</div><div><p className="mb-2 text-sm font-bold">Ghi chú</p><div className="flex flex-wrap gap-2">{quickNotes.map((note) => <label key={note} className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold"><Checkbox checked={notes.includes(note)} onCheckedChange={(checked) => setNotes((current) => checked ? [...current, note] : current.filter((value) => value !== note))}/>{note}</label>)}</div></div><Textarea value={otherNote} onChange={(e) => setOtherNote(e.target.value)} placeholder="Ghi chú khác..." />{error && <p className="text-sm text-red-600">{error}</p>}<div className="flex items-center justify-between border-t pt-4"><div><p className="text-xs text-zinc-500">Tổng cộng</p><p className="text-2xl font-black">{formatMoney(total)}</p></div><Button className="bg-[#bd3b22]" disabled={!selected.length || saving} onClick={create}>{saving ? "Đang tạo..." : "Tạo đơn"}</Button></div></DialogContent>;
}
