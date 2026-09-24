"use client";

import { type CSSProperties, type Dispatch, type FormEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ChefHat, CircleDollarSign, Clock3, LoaderCircle, Pencil, Plus, RefreshCw, Store, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney, type MenuItem } from "@/lib/menu";

type OrderItem = { id: number; menuItemId: string | null; itemName: string; price: number; quantity: number; notes: string };
type Order = { id: string; code: string; tableCode: string | null; orderType: string; source: string; status: string; customerName: string; note: string; total: number; paymentStatus: string; createdAt: string; items: OrderItem[] };
const columns = [
  { id: "new", statuses: ["new"], title: "Đơn mới", icon: Clock3, actionIcon: ChefHat, action: "Hoàn thành", next: "cooking" },
  { id: "cooking", statuses: ["cooking", "served"], title: "Đã làm", icon: ChefHat, actionIcon: CircleDollarSign, action: "Thanh toán", next: "paid" },
  { id: "paid", statuses: ["paid"], title: "Đã thanh toán", icon: CircleDollarSign, actionIcon: CircleDollarSign, action: "", next: "" },
] as const;
const quickNotes = ["Giảm cay","Không hành", "Không giá đỗ", "Không rau"];
type OrderStatus = (typeof columns)[number]["id"];
type CountEffect = { change: number; sequence: number };

function parseOrderNote(note: string) {
  const parts = note.split(",").map((part) => part.trim()).filter(Boolean);
  return {
    notes: quickNotes.filter((quickNote) => parts.includes(quickNote)),
    otherNote: parts.filter((part) => !quickNotes.includes(part)).join(", "),
  };
}

function composeOrderNote(notes: string[], otherNote: string) {
  return [...notes, otherNote.trim()].filter(Boolean).join(", ");
}

const orderTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Ho_Chi_Minh",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function formatOrderTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa rõ thời gian";
  const parts = Object.fromEntries(orderTimeFormatter.formatToParts(date).map(({ type, value }) => [type, value]));
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
}


export function AdminDashboard({ ownerName, menu }: { ownerName: string; menu: MenuItem[] }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<OrderStatus>("new");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<{ kind: "single" | "bulk"; ids: string[]; label: string; confirmTitle?: string } | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [unpayTarget, setUnpayTarget] = useState<Order | null>(null);
  const [unpayLoading, setUnpayLoading] = useState(false);
  const [unpayError, setUnpayError] = useState("");
  const [editTarget, setEditTarget] = useState<Order | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const updatingIdsRef = useRef(new Set<string>());
  const knownOrderIdsRef = useRef<Set<string> | null>(null);
  const mobileTabRef = useRef<OrderStatus>("new");
  const [updatingIds, setUpdatingIds] = useState<string[]>([]);
  const [newOrderSignal, setNewOrderSignal] = useState(0);
  const previousCountsRef = useRef<Record<OrderStatus, number> | null>(null);
  const effectSequenceRef = useRef(0);
  const [countEffects, setCountEffects] = useState<Partial<Record<OrderStatus, CountEffect>>>({});

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch("/api/orders", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      const nextOrders = result.orders as Order[];
      const availableIds = new Set<string>(nextOrders.map((order) => order.id));
      const nextCounts = Object.fromEntries(columns.map((column) => [
        column.id, nextOrders.filter((order) => column.statuses.some((status) => status === order.status)).length,
      ])) as Record<OrderStatus, number>;
      const previousCounts = previousCountsRef.current;
      previousCountsRef.current = nextCounts;
      if (previousCounts) {
        const changes = columns.flatMap((column) => {
          const change = nextCounts[column.id] - previousCounts[column.id];
          return change === 0 ? [] : [[column.id, { change, sequence: ++effectSequenceRef.current }] as const];
        });
        if (changes.length) setCountEffects((current) => ({ ...current, ...Object.fromEntries(changes) }));
      }
      const hasNewOrder = knownOrderIdsRef.current !== null
        && nextOrders.some((order) => order.status === "new" && !knownOrderIdsRef.current?.has(order.id));

      knownOrderIdsRef.current = availableIds;
      setOrders(nextOrders);
      setSelectedIds((current) => current.filter((id) => availableIds.has(id)));
      if (hasNewOrder
        && window.matchMedia("(max-width: 1279px)").matches
        && mobileTabRef.current !== "new") {
        mobileTabRef.current = "new";
        setMobileTab("new");
        setNewOrderSignal((current) => current + 1);
        requestAnimationFrame(() => {
          document.getElementById("order-tab-new")?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        });
      }
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

  useEffect(() => {
    const timers = (Object.entries(countEffects) as [OrderStatus, CountEffect][]).map(([status, effect]) =>
      setTimeout(() => setCountEffects((current) => {
        if (current[status]?.sequence !== effect.sequence) return current;
        const next = { ...current };
        delete next[status];
        return next;
      }), 1000));
    return () => timers.forEach(clearTimeout);
  }, [countEffects]);

  async function updateStatus(id: string, status: string, confirmUnpay = false): Promise<boolean> {
    if (updatingIdsRef.current.has(id)) return false;
    updatingIdsRef.current.add(id);
    setUpdatingIds([...updatingIdsRef.current]);
    setError("");

    try {
      const response = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, confirmUnpay }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error || "Không thể cập nhật trạng thái đơn");
      }
      await load(true);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể cập nhật trạng thái đơn");
      return false;
    } finally {
      updatingIdsRef.current.delete(id);
      setUpdatingIds([...updatingIdsRef.current]);
    }
  }

  function requestDelete(kind: "single" | "bulk", ids: string[], label: string, confirmTitle?: string) {
    setDeleteError("");
    setDeleteTarget({ kind, ids, label, confirmTitle });
  }

  function handleSwipe(order: Order, direction: "left" | "right") {
    if (order.status === "new") {
      if (direction === "left") requestDelete("single", [order.id], `đơn ${order.code}`);
      else void updateStatus(order.id, "cooking");
    } else if (order.status === "cooking" || order.status === "served") {
      void updateStatus(order.id, direction === "left" ? "new" : "paid");
    } else if (order.status === "paid") {
      if (direction === "left") { setUnpayError(""); setUnpayTarget(order); }
      else requestDelete("single", [order.id], `đơn ${order.code}`, "Xoá đơn đã thanh toán này");
    }
  }

  async function confirmUnpay() {
    if (!unpayTarget || unpayLoading) return;
    setUnpayLoading(true);
    setUnpayError("");
    const success = await updateStatus(unpayTarget.id, "cooking", true);
    if (success) setUnpayTarget(null);
    else setUnpayError("Không thể chuyển đơn sang chưa thanh toán. Vui lòng thử lại.");
    setUnpayLoading(false);
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
  const visibleOrders = orders.filter((order) => columns.some((column) => column.statuses.some((status) => status === order.status)));
  const allSelected = visibleOrders.length > 0 && visibleOrders.every((order) => selectedIds.includes(order.id));
  const mobileOrders = orders.filter((order) => columns.find((column) => column.id === mobileTab)?.statuses.some((status) => status === order.status));
  const mobileAllSelected = mobileOrders.length > 0 && mobileOrders.every((order) => selectedIds.includes(order.id));

  function selectMobileTab(status: OrderStatus) {
    mobileTabRef.current = status;
    setMobileTab(status);
  }

  return <main className="min-h-screen overflow-x-clip bg-[#fff7eb] text-[#2e201c]">
    <header className="border-b border-[#e9d7c5] bg-[#fffaf2]">
      <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Link href="/" className="grid size-11 shrink-0 place-items-center rounded-lg bg-[#b92717] text-white shadow-sm transition-colors hover:bg-[#9e281c]" aria-label="Về menu đặt món"><Store className="size-5" /></Link>
          <div className="min-w-0"><h1 className="truncate text-base font-black sm:text-lg">MELI · Quản lý đơn</h1><p className="truncate text-xs text-zinc-500 sm:text-sm">Xin chào, {ownerName}</p></div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="ghost" size="icon" className="size-11 rounded-lg bg-[#e7ece8] hover:bg-[#dce3de]" onClick={() => load()} aria-label="Làm mới"><RefreshCw className="size-4" /></Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="h-11 rounded-lg bg-[#b92717] px-3.5 font-bold hover:bg-[#9e281c] sm:px-4"><Plus className="size-4" /> Tạo đơn</Button></DialogTrigger>
            <CreateOrderDialog menu={menu} onCreated={() => { setOpen(false); load(true); }} />
          </Dialog>
        </div>
      </div>
    </header>
    <section className="mx-auto min-w-0 max-w-[1500px] px-4 py-4 sm:py-6">
      <div role="tablist" aria-label="Trạng thái đơn hàng" className="sticky top-0 z-20 -mx-4 mb-4 grid grid-cols-3 gap-2 border-y border-[#e9d7c5] bg-[#fff7eb]/95 px-4 py-3 backdrop-blur xl:hidden">
        {columns.map((column) => {
          const Icon = column.icon;
          const count = orders.filter((order) => column.statuses.some((status) => status === order.status)).length;
          return <button key={`${column.id}-${column.id === "new" ? newOrderSignal : 0}`} id={`order-tab-${column.id}`} type="button" role="tab" tabIndex={mobileTab === column.id ? 0 : -1} aria-controls={`order-panel-${column.id}`} aria-selected={mobileTab === column.id} onClick={() => selectMobileTab(column.id)} onKeyDown={(event) => {
            const index = columns.findIndex((entry) => entry.id === column.id);
            const nextIndex = event.key === "ArrowRight" ? (index + 1) % columns.length
              : event.key === "ArrowLeft" ? (index + columns.length - 1) % columns.length
              : event.key === "Home" ? 0
              : event.key === "End" ? columns.length - 1 : -1;
            if (nextIndex < 0) return;
            event.preventDefault();
            const next = columns[nextIndex].id;
            selectMobileTab(next);
            document.getElementById(`order-tab-${next}`)?.focus();
          }} className={`flex min-w-0 items-center justify-between gap-1 rounded-xl border px-2 py-2.5 text-xs font-bold sm:justify-start sm:gap-2 sm:px-3 sm:text-sm ${column.id === "new" && newOrderSignal > 0 ? "animate-new-order" : ""} ${mobileTab === column.id ? "border-[#a82d1e] bg-[#a82d1e] text-white" : "border-[#e9d7c5] bg-white text-[#2e201c]"}`}>
            <Icon className="hidden size-4 shrink-0 sm:block" aria-hidden="true" /><span className="min-w-0 truncate">{column.title}</span><OrderCountBadge count={count} effect={countEffects[column.id]} active={mobileTab === column.id} />
          </button>;
        })}
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2 sm:mb-4 sm:grid-cols-3">
        <Stat label="Đơn đang mở" value={`${activeCount}`} />
        <Stat label="Đã thanh toán" value={`${orders.filter((o) => o.status === "paid").length} đơn`} />
        <div className="col-span-2 sm:col-span-1"><Stat label="Doanh thu ghi nhận" value={formatMoney(todayRevenue)} /></div>
      </div>
      {error && <p className="mb-5 rounded-2xl bg-red-50 p-4 text-red-700">{error}</p>}
      <div className="mb-4 hidden flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-3 xl:flex">
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
      <div className="mb-4 grid min-w-0 gap-2 rounded-2xl border bg-white p-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between xl:hidden">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
          <Checkbox checked={mobileAllSelected} disabled={!mobileOrders.length || deleting} onCheckedChange={(checked) => setSelectedIds((current) => checked === true ? [...new Set([...current, ...mobileOrders.map((order) => order.id)])] : current.filter((id) => !mobileOrders.some((order) => order.id === id)))} aria-label={`Chọn tất cả đơn ${columns.find((column) => column.id === mobileTab)?.title}`} />
          Chọn trong tab ({mobileOrders.length})
        </label>
        <div className="flex min-w-0 items-center justify-between gap-2">
          {selectedIds.length > 0 && <span className="text-xs text-zinc-600">Đã chọn {selectedIds.length}</span>}
          <Button variant="destructive" size="sm" disabled={!selectedIds.length || deleting} onClick={() => requestDelete("bulk", selectedIds, `${selectedIds.length} đơn đã chọn`)}><Trash2 className="size-4" /> Xóa đã chọn</Button>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        {columns.map((column) => {
          const Icon = column.icon;
          const ActionIcon = column.actionIcon;
          const list = orders.filter((order) => column.statuses.some((status) => status === order.status));
          return <div key={column.id} id={`order-panel-${column.id}`} role="tabpanel" aria-labelledby={`order-tab-${column.id}`} className={`min-h-64 min-w-0 rounded-2xl bg-[#eaede8] p-2 sm:p-3 xl:rounded-3xl ${mobileTab === column.id ? "" : "hidden xl:block"}`}>
            <div className="mb-3 flex items-center justify-between px-2">
              <h2 className="flex items-center gap-2 font-black"><Icon className="size-4" />{column.title}</h2>
              <OrderCountBadge count={list.length} effect={countEffects[column.id]} desktop />
            </div>
            <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-2 text-[11px] font-medium text-zinc-600 xl:hidden">
              <span className="inline-flex items-center gap-1"><ArrowRight className="size-3.5 shrink-0" aria-hidden="true" />{column.id === "new" ? "Đã làm" : column.id === "cooking" ? "Thanh toán" : "Xóa đơn"}</span>
              <span className="inline-flex items-center gap-1"><ArrowLeft className="size-3.5 shrink-0" aria-hidden="true" />{column.id === "new" ? "Xóa đơn" : column.id === "cooking" ? "Đơn mới" : "Chưa thanh toán"}</span>
            </div>
            <div className="space-y-3">
              {loading && !orders.length ? <div className="rounded-2xl bg-white p-5 text-sm text-zinc-500">Đang tải...</div> : !list.length ? <p className="rounded-2xl bg-white p-5 text-sm text-zinc-500">Chưa có đơn ở trạng thái này.</p> : list.map((order) =>
                <SwipeableOrderCard key={order.id} order={order} busy={updatingIds.includes(order.id) || deleting} loading={updatingIds.includes(order.id) || (deleting && deleteTarget?.ids.includes(order.id) === true)} onSwipe={handleSwipe}>
                <article className="min-w-0 overflow-hidden rounded-xl border border-[#c83220] bg-white shadow-sm">
                  <div className="p-3 sm:p-4">
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <div className="flex min-w-0 items-start gap-2.5">
                        <Checkbox className="mt-0.5 size-5 border-[#b92717] data-[state=checked]:border-[#b92717] data-[state=checked]:bg-[#b92717]" checked={selectedIds.includes(order.id)} onCheckedChange={(checked) => setSelectedIds((current) => checked === true ? [...current, order.id] : current.filter((id) => id !== order.id))} aria-label={`Chọn đơn ${order.code}`} />
                        <div className="min-w-0">
                          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] sm:text-xs">
                            <span className="max-w-full break-all rounded bg-[#fff0ed] px-1.5 py-0.5 font-bold text-[#a82d1e]">{order.code}</span>
                            <span className="text-zinc-600">{order.source === "staff_pos" ? "Chủ quán tạo" : "Khách tự đặt"}</span>
                            <time dateTime={order.createdAt} title="Giờ Việt Nam" className="whitespace-nowrap text-zinc-500">{formatOrderTime(order.createdAt)}</time>
                          </div>
                          <h3 className="mt-1.5 min-w-0 break-words text-lg font-black leading-tight">{order.orderType === "takeaway" ? "Mang về" : order.tableCode ? `Bàn ${order.tableCode}` : "Dùng tại chỗ"}</h3>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        {column.id === "new" && <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700"><span className="size-1.5 rounded-full bg-red-500" aria-hidden="true" />Chưa làm xong</span>}
                        {column.id === "cooking" && <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700"><span className="size-1.5 rounded-full bg-amber-500" aria-hidden="true" />Chưa thanh toán</span>}
                        {column.id === "paid" && <span className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-700"><span className="size-1.5 rounded-full bg-green-500" aria-hidden="true" />Đã thanh toán</span>}
                        {column.next && <Button size="sm" className="h-9 rounded-lg bg-[#b92717] px-3 font-bold hover:bg-[#9e281c]" disabled={updatingIds.includes(order.id)} aria-busy={updatingIds.includes(order.id)} onClick={() => updateStatus(order.id, column.next)}>{updatingIds.includes(order.id) ? <><LoaderCircle className="size-4 animate-spin" aria-hidden="true" /><span className="sr-only">Đang cập nhật...</span></> : <><ActionIcon className="size-4" />{column.action}</>}</Button>}
                      </div>
                    </div>
                    <div className="mt-3 border-y py-1">{order.items.map((item) =>
                      <div key={item.id} className="flex min-w-0 items-center justify-between gap-2 py-2.5 text-sm">
                        <span className="min-w-0 break-words"><b className="mr-1.5 text-[#b92717]">{item.quantity}×</b>{item.itemName}</span>
                        <span className="shrink-0 font-medium">{formatMoney(item.price * item.quantity)}</span>
                      </div>
                    )}</div>
                    {order.note && <p className="mt-2 break-words rounded bg-[#f5f0ed] px-2.5 py-2 text-xs italic text-[#9e281c]"><b>Ghi chú:</b> {order.note}</p>}
                  </div>
                  <div className="flex min-w-0 items-center gap-1.5 border-t bg-[#fffdf9] px-3 py-2.5 sm:px-4">
                    <p className="min-w-0 flex-1 truncate text-[11px] text-zinc-600" title={order.customerName?.trim() || "Chưa cung cấp"}>Khách: <span className="font-medium text-[#2e201c]">{order.customerName?.trim() || "Chưa cung cấp"}</span></p>
                    <div className="flex shrink-0 items-center gap-0.5">
                      {["new", "cooking", "served"].includes(order.status) && order.paymentStatus !== "paid" && <Button variant="ghost" size="icon-sm" disabled={updatingIds.includes(order.id)} className="text-[#a82d1e] hover:bg-[#fff0df]" onClick={() => setEditTarget(order)} aria-label={`Sửa đơn ${order.code}`} title="Sửa đơn"><Pencil className="size-4" /></Button>}
                      <Button variant="ghost" size="icon-sm" className="text-red-700 hover:bg-red-50 hover:text-red-800" onClick={() => requestDelete("single", [order.id], `đơn ${order.code}`)} aria-label={`Xóa đơn ${order.code}`} title="Xóa đơn"><Trash2 className="size-4" /></Button>
                    </div>
                    <b className="shrink-0 text-base text-[#b92717] sm:text-lg">{formatMoney(order.total)}</b>
                  </div>
                </article>
                </SwipeableOrderCard>
              )}
            </div>
          </div>;
        })}
      </div>
    </section>
    <Dialog open={editTarget !== null} onOpenChange={(next) => { if (!next && !savingEdit) setEditTarget(null); }}>
      {editTarget && <EditOrderDialog order={editTarget} menu={menu} onSavingChange={setSavingEdit} onClose={() => setEditTarget(null)} onSaved={() => { setEditTarget(null); void load(true); }} />}
    </Dialog>
    <Dialog open={unpayTarget !== null} onOpenChange={(next) => { if (!next && !unpayLoading) { setUnpayTarget(null); setUnpayError(""); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Chuyển đơn này thành chưa thanh toán</DialogTitle>
          <DialogDescription>Đơn {unpayTarget?.code} sẽ trở lại tab Đã làm và không còn được tính là đã thanh toán.</DialogDescription>
        </DialogHeader>
        {unpayError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{unpayError}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={unpayLoading} onClick={() => setUnpayTarget(null)}>Không, giữ lại</Button>
          <Button disabled={unpayLoading} onClick={() => void confirmUnpay()}>{unpayLoading ? "Đang chuyển..." : "Đồng ý chuyển"}</Button>
        </div>
      </DialogContent>
    </Dialog>
    <Dialog open={deleteTarget !== null} onOpenChange={(next) => { if (!next && !deleting) { setDeleteTarget(null); setDeleteError(""); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{deleteTarget?.confirmTitle ?? `Xóa ${deleteTarget?.label}?`}</DialogTitle>
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


type SwipeDirection = "left" | "right";

function SwipeableOrderCard({ order, busy, loading, onSwipe, children }: {
  order: Order;
  busy: boolean;
  loading: boolean;
  onSwipe: (order: Order, direction: SwipeDirection) => void;
  children: ReactNode;
}) {
  const gesture = useRef<{ pointerId: number; startX: number; startY: number; dragging: boolean } | null>(null);
  const distance = useRef(0);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [offset, setOffset] = useState(0);
  const [settling, setSettling] = useState(false);

  useEffect(() => () => { if (resetTimer.current) clearTimeout(resetTimer.current); }, []);

  function finish(activate: boolean) {
    const dx = distance.current;
    const valid = activate && Math.abs(dx) >= 78;
    gesture.current = null;
    distance.current = 0;
    setSettling(true);
    setOffset(valid ? Math.sign(dx) * 110 : 0);
    if (resetTimer.current) clearTimeout(resetTimer.current);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    resetTimer.current = setTimeout(() => {
      setOffset(0);
      if (valid) onSwipe(order, dx > 0 ? "right" : "left");
      resetTimer.current = setTimeout(() => setSettling(false), reducedMotion ? 0 : 180);
    }, reducedMotion ? 0 : 180);
  }

  function pointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (busy || settling || window.matchMedia("(min-width: 1280px)").matches) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if ((event.target as HTMLElement).closest("button, a, input, textarea, select, [role=checkbox]")) return;
    gesture.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, dragging: false };
    distance.current = 0;
  }

  function pointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;
    if (!current.dragging) {
      if (Math.abs(dx) < 12 || Math.abs(dx) <= Math.abs(dy) * 1.2) return;
      current.dragging = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    distance.current = dx;
    setOffset(Math.max(-120, Math.min(120, dx * 0.8)));
  }

  function pointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (gesture.current?.pointerId !== event.pointerId) return;
    finish(gesture.current.dragging);
  }

  const rightLabel = order.status === "new" ? "Đã làm" : order.status === "paid" ? "Xóa đơn" : "Thanh toán";
  const leftLabel = order.status === "new" ? "Xóa đơn" : order.status === "paid" ? "Chưa thanh toán" : "Đơn mới";
  const deleteAction = offset < 0 && order.status === "new" || offset > 0 && order.status === "paid";

  return <div className="relative min-w-0 touch-pan-y xl:touch-auto" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={() => { if (gesture.current) finish(false); }}>
    {offset !== 0 && <div aria-hidden="true" className={`pointer-events-none absolute inset-0 flex items-center ${offset > 0 ? "justify-start pl-3" : "justify-end pr-3"} rounded-xl text-xs font-bold text-white xl:hidden ${deleteAction ? "bg-red-600" : "bg-[#258067]"}`}>
      <span className="flex max-w-[88px] flex-col items-center gap-1 text-center leading-tight">
        {offset > 0 ? <ArrowRight className="size-5" /> : <ArrowLeft className="size-5" />}
        {offset > 0 ? rightLabel : leftLabel}
      </span>
    </div>}
    <div className="relative origin-bottom rounded-xl" style={{
      transform: `translate3d(${offset}px, 0, 0) rotate(${offset / 18}deg)`,
      transition: settling ? "transform 180ms ease-out" : undefined,
    }}>
      <div className={loading ? "invisible" : undefined} inert={loading} aria-hidden={loading}>{children}</div>
      {loading && <div role="status" aria-label="Đang xử lý đơn hàng" className="absolute inset-0 flex flex-col rounded-xl border border-[#c83220] bg-white p-4 shadow-sm">
        <div className="flex animate-pulse items-start justify-between gap-3">
          <div className="w-2/3 space-y-3"><div className="h-3 w-28 max-w-full rounded bg-[#eadfd7]" /><div className="h-5 w-3/4 rounded bg-[#eadfd7]" /></div>
          <div className="h-9 w-20 rounded bg-[#eadfd7]" />
        </div>
        <div className="my-4 flex flex-1 animate-pulse flex-col justify-around gap-3 border-y py-3">
          <div className="h-3 w-4/5 rounded bg-[#f0e8e2]" />
          <div className="h-3 w-2/3 rounded bg-[#f0e8e2]" />
          <div className="h-3 w-3/4 rounded bg-[#f0e8e2]" />
        </div>
        <div className="flex animate-pulse items-center justify-between gap-3">
          <div className="h-3 w-2/5 rounded bg-[#eadfd7]" />
          <div className="h-5 w-1/3 rounded bg-[#eadfd7]" />
        </div>
      </div>}
    </div>
  </div>;
}

const confettiVectors = [
  [-31, -31], [-10, -40], [12, -38], [31, -26],
  [-35, 5], [35, 4], [-19, 27], [19, 29],
] as const;
const confettiColors = ["#fbbf24", "#ef4444", "#22c55e", "#f97316", "#38bdf8", "#facc15", "#fb7185", "#a78bfa"];

function OrderCountBadge({ count, effect, active = false, desktop = false }: {
  count: number;
  effect?: CountEffect;
  active?: boolean;
  desktop?: boolean;
}) {
  return <span className="relative inline-flex shrink-0 items-center justify-center">
    <span key={effect?.sequence ?? 0} aria-live="polite" aria-atomic="true" className={`relative min-w-6 rounded-full text-center font-black ${desktop ? "bg-white px-2.5 py-1 text-xs" : `px-1.5 py-0.5 text-xs ${active ? "bg-white/20" : "bg-[#fff0df]"}`} ${effect?.change && effect.change > 0 ? "order-count-up" : effect?.change ? "order-count-down" : ""}`}>{count}</span>
    {effect && <span key={effect.sequence} aria-hidden="true" className="pointer-events-none absolute inset-0">
      {effect.change > 0 ? confettiVectors.map(([dx, dy], index) =>
        <i key={index} className="order-count-confetti" style={{
          "--dx": `${dx}px`, "--dy": `${dy}px`, backgroundColor: confettiColors[index],
        } as CSSProperties} />
      ) : <span className="order-count-minus">−{Math.abs(effect.change)}</span>}
    </span>}
  </span>;
}

function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border bg-white px-3 py-2.5"><p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">{label}</p><p className="mt-0.5 text-lg font-black leading-tight">{value}</p></div>; }


type EditLine = {
  key: string;
  existingId?: number;
  menuItemId?: string | null;
  name: string;
  price: number;
  quantity: number;
};

function EditOrderDialog({
  order, menu, onSavingChange, onClose, onSaved,
}: {
  order: Order;
  menu: MenuItem[];
  onSavingChange: (saving: boolean) => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  const initialNote = parseOrderNote(order.note);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [tableCode, setTableCode] = useState(order.tableCode ?? "");
  const [isTakeaway, setIsTakeaway] = useState(order.orderType === "takeaway");
  const [customerName, setCustomerName] = useState(order.customerName);
  const [notes, setNotes] = useState<string[]>(initialNote.notes);
  const [otherNote, setOtherNote] = useState(initialNote.otherNote);
  const [lines, setLines] = useState<EditLine[]>(() => order.items.map((item) => ({
    key: `existing-${item.id}`, existingId: item.id, menuItemId: item.menuItemId,
    name: item.itemName, price: item.price, quantity: item.quantity,
  })));
  const [selectedMenuId, setSelectedMenuId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const total = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);

  function changeQuantity(key: string, delta: number) {
    setLines((current) => current.map((line) => line.key === key
      ? { ...line, quantity: Math.max(1, Math.min(20, line.quantity + delta)) }
      : line));
  }

  function addItem() {
    const item = menu.find((entry) => entry.id === selectedMenuId);
    if (!item) return;
    setLines((current) => {
      const existing = current.find((line) => line.menuItemId === item.id
        || (line.menuItemId == null && line.name === item.name));
      if (existing) return current.map((line) => line.key === existing.key
        ? { ...line, quantity: Math.min(20, line.quantity + 1) } : line);
      return [...current, {
        key: `new-${item.id}`, menuItemId: item.id, name: item.name,
        price: item.price, quantity: 1,
      }];
    });
    setSelectedMenuId("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !lines.length) return;
    setSaving(true);
    onSavingChange(true);
    setError("");
    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tableCode: isTakeaway ? "" : tableCode,
          orderType: isTakeaway ? "takeaway" : "dine_in",
          customerName, note: composeOrderNote(notes, otherNote),
          items: lines.map((line) => line.existingId
            ? { id: line.existingId, quantity: line.quantity }
            : { menuItemId: line.menuItemId, quantity: line.quantity }),
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || "Không thể lưu thay đổi");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể lưu thay đổi");
    } finally {
      setSaving(false);
      onSavingChange(false);
    }
  }

  return <DialogContent className="max-h-[90dvh] w-[calc(100%-1.5rem)] overflow-y-auto sm:max-w-xl" onOpenAutoFocus={(event) => { event.preventDefault(); titleRef.current?.focus(); }}>
    <DialogHeader>
      <DialogTitle ref={titleRef} tabIndex={-1} className="outline-none">Sửa đơn {order.code}</DialogTitle>
      <DialogDescription>Chỉnh sửa món và thông tin trước khi đơn hoàn thành.</DialogDescription>
    </DialogHeader>
    <form onSubmit={(event) => void save(event)} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="space-y-1 text-sm font-semibold">Số bàn
            <Input value={tableCode} maxLength={20} disabled={saving || isTakeaway} onChange={(event) => setTableCode(event.target.value)} placeholder={isTakeaway ? "Không áp dụng khi mang về" : "Có thể để trống"} />
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
            <Checkbox checked={isTakeaway} disabled={saving} onCheckedChange={(checked) => { const next = checked === true; setIsTakeaway(next); if (next) setTableCode(""); }} />
            Mang về
          </label>
        </div>
        <label className="space-y-1 text-sm font-semibold">Tên khách
          <Input value={customerName} maxLength={80} disabled={saving} onChange={(event) => setCustomerName(event.target.value)} placeholder="Tên khách" />
        </label>
      </div>
      <div>
        <p className="mb-2 text-sm font-bold">Món trong đơn</p>
        <div className="space-y-2">
          {lines.map((line) => <div key={line.key} className="flex items-center gap-2 rounded-xl border p-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{line.name}</p>
              <p className="text-xs text-zinc-500">{formatMoney(line.price)} / món</p>
            </div>
            <Button type="button" size="icon-sm" variant="outline" disabled={saving || line.quantity <= 1} onClick={() => changeQuantity(line.key, -1)} aria-label={`Giảm ${line.name}`}>−</Button>
            <span className="w-5 text-center text-sm font-bold">{line.quantity}</span>
            <Button type="button" size="icon-sm" variant="outline" disabled={saving || line.quantity >= 20} onClick={() => changeQuantity(line.key, 1)} aria-label={`Thêm ${line.name}`}>+</Button>
            <Button type="button" size="icon-sm" variant="ghost" disabled={saving} onClick={() => setLines((current) => current.filter((entry) => entry.key !== line.key))} aria-label={`Bỏ ${line.name}`} className="text-red-700"><Trash2 className="size-4" /></Button>
          </div>)}
          {!lines.length && <p className="rounded-xl border border-dashed p-3 text-sm text-zinc-500">Hãy thêm ít nhất một món.</p>}
        </div>
      </div>
      <div className="flex gap-2">
        <select aria-label="Chọn món để thêm" value={selectedMenuId} disabled={saving} onChange={(event) => setSelectedMenuId(event.target.value)} className="min-w-0 flex-1 rounded-md border bg-white px-3 py-2 text-sm">
          <option value="">Chọn món để thêm...</option>
          {menu.map((item) => <option key={item.id} value={item.id}>{item.name} · {formatMoney(item.price)}</option>)}
        </select>
        <Button type="button" variant="outline" disabled={!selectedMenuId || saving} onClick={addItem}><Plus className="size-4" /> Thêm</Button>
      </div>
      <OrderNoteFields notes={notes} otherNote={otherNote} disabled={saving} setNotes={setNotes} setOtherNote={setOtherNote} />
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="sticky bottom-0 -mx-6 -mb-6 flex flex-wrap items-center justify-between gap-3 border-t bg-white p-4">
        <div><p className="text-xs text-zinc-500">Tổng cộng</p><p className="text-lg font-black">{formatMoney(total)}</p></div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" disabled={saving} onClick={onClose}>Hủy</Button>
          <Button type="submit" disabled={saving || !lines.length} className="bg-[#a82d1e] hover:bg-[#89291d]">{saving ? <><LoaderCircle className="size-4 animate-spin" /> Đang lưu...</> : "Lưu thay đổi"}</Button>
        </div>
      </div>
    </form>
  </DialogContent>;
}

function OrderNoteFields({
  notes,
  otherNote,
  disabled,
  setNotes,
  setOtherNote,
}: {
  notes: string[];
  otherNote: string;
  disabled: boolean;
  setNotes: Dispatch<SetStateAction<string[]>>;
  setOtherNote: (value: string) => void;
}) {
  return <div className="space-y-3">
    <fieldset disabled={disabled}>
      <legend className="mb-2 text-sm font-bold">Ghi chú</legend>
      <div className="flex flex-wrap gap-2">
        {quickNotes.map((note) => <label key={note} className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold ${notes.includes(note) ? "border-[#a82d1e] bg-[#fff0df] text-[#89291d]" : "bg-white"}`}>
          <Checkbox checked={notes.includes(note)} onCheckedChange={(checked) => setNotes((current) => checked ? [...current, note] : current.filter((value) => value !== note))} />
          {note}
        </label>)}
      </div>
    </fieldset>
    <label className="block space-y-1 text-sm font-semibold">Ghi chú khác
      <Textarea value={otherNote} maxLength={440} disabled={disabled} onChange={(event) => setOtherNote(event.target.value)} placeholder="Ghi chú cho bếp..." />
    </label>
  </div>;
}

function CreateOrderDialog({ onCreated, menu }: { onCreated: () => void; menu: MenuItem[] }) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [tableCode, setTableCode] = useState("");
  const [isTakeaway, setIsTakeaway] = useState(false);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<string[]>([]);
  const [otherNote, setOtherNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const selected = menu.filter((item) => cart[item.id]);
  const total = useMemo(() => selected.reduce((sum, item) => sum + item.price * cart[item.id], 0), [selected, cart]);

  function reset() {
    setTableCode("");
    setIsTakeaway(false);
    setCart({});
    setNotes([]);
    setOtherNote("");
    setError("");
  }

  async function create() {
    if (saving || !selected.length) return;
    const normalizedTableCode = isTakeaway ? "" : tableCode.trim();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: "staff_pos",
          tableCode: normalizedTableCode,
          orderType: isTakeaway ? "takeaway" : "dine_in",
          note: composeOrderNote(notes, otherNote),
          items: selected.map((item) => ({ id: item.id, quantity: cart[item.id], notes })),
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || "Không thể tạo đơn");
      reset();
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tạo đơn");
    } finally {
      setSaving(false);
    }
  }

  return <DialogContent className="max-h-[90dvh] w-[calc(100%-1.5rem)] overflow-y-auto sm:max-w-3xl" onOpenAutoFocus={(event) => { event.preventDefault(); titleRef.current?.focus(); }}>
    <DialogHeader>
      <DialogTitle ref={titleRef} tabIndex={-1} className="text-2xl outline-none">Tạo đơn tại quầy</DialogTitle>
      <DialogDescription>Chọn món và hình thức dùng món.</DialogDescription>
    </DialogHeader>
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <Input value={tableCode} maxLength={20} disabled={saving || isTakeaway} onChange={(event) => setTableCode(event.target.value)} placeholder={isTakeaway ? "Không áp dụng khi mang về" : "Số bàn (có thể để trống)"} />
      <label className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm font-semibold">
        <Checkbox checked={isTakeaway} disabled={saving} onCheckedChange={(checked) => { const next = checked === true; setIsTakeaway(next); if (next) setTableCode(""); }} />
        Mang về
      </label>
    </div>
    <div className="grid gap-2 sm:grid-cols-2">
      {menu.map((item) => {
        const quantity = cart[item.id] ?? 0;
        return <div key={item.id} className="flex items-center gap-2 rounded-xl border p-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold">{item.name}</p>
            <p className="text-sm text-[#9e281c]">{formatMoney(item.price)}</p>
          </div>
          <Button type="button" variant="outline" size="icon-sm" disabled={saving || quantity <= 0} onClick={() => setCart((current) => ({ ...current, [item.id]: Math.max(0, (current[item.id] ?? 0) - 1) }))} aria-label={`Giảm ${item.name}`}>−</Button>
          <b className="w-5 text-center">{quantity}</b>
          <Button type="button" variant="outline" size="icon-sm" disabled={saving || quantity >= 20} onClick={() => setCart((current) => ({ ...current, [item.id]: Math.min(20, (current[item.id] ?? 0) + 1) }))} aria-label={`Thêm ${item.name}`}>+</Button>
        </div>;
      })}
    </div>
    <OrderNoteFields notes={notes} otherNote={otherNote} disabled={saving} setNotes={setNotes} setOtherNote={setOtherNote} />
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="sticky bottom-0 -mx-6 -mb-6 flex items-center justify-between gap-3 border-t bg-white p-4">
      <div><p className="text-xs text-zinc-500">Tổng cộng</p><p className="text-2xl font-black">{formatMoney(total)}</p></div>
      <Button className="bg-[#bd3b22] hover:bg-[#9e281c]" disabled={!selected.length || saving} onClick={() => void create()}>{saving ? "Đang tạo..." : "Tạo đơn"}</Button>
    </div>
  </DialogContent>;
}
