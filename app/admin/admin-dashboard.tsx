"use client";

import { type Dispatch, type FormEvent, type SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChefHat, CircleDollarSign, Clock3, LoaderCircle, Pencil, Plus, RefreshCw, Store, Trash2, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney, type MenuItem } from "@/lib/menu";

type OrderItem = { id: number; menuItemId: string | null; itemName: string; price: number; quantity: number; notes: string };
type Order = { id: string; code: string; tableCode: string | null; orderType: string; source: string; status: string; customerName: string; note: string; total: number; paymentStatus: string; createdAt: string; items: OrderItem[] };
const columns = [
  { id: "new", title: "Đơn mới", icon: Clock3, action: "Bắt đầu làm", next: "cooking" },
  { id: "cooking", title: "Đang làm", icon: ChefHat, action: "Đã phục vụ", next: "served" },
  { id: "served", title: "Đã phục vụ", icon: UtensilsCrossed, action: "Đã thanh toán", next: "paid" },
  { id: "paid", title: "Hoàn thành", icon: CircleDollarSign, action: "", next: "" },
] as const;
const quickNotes = ["Ít cay", "Không hành", "Không giá"];
type OrderStatus = (typeof columns)[number]["id"];

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
  return `${parts.day}/${parts.month}/${parts.year}\n${parts.hour}:${parts.minute}`;
}


export function AdminDashboard({ ownerName, menu }: { ownerName: string; menu: MenuItem[] }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<OrderStatus>("new");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<{ kind: "single" | "bulk"; ids: string[]; label: string } | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [editTarget, setEditTarget] = useState<Order | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const updatingIdsRef = useRef(new Set<string>());
  const knownOrderIdsRef = useRef<Set<string> | null>(null);
  const mobileTabRef = useRef<OrderStatus>("new");
  const [updatingIds, setUpdatingIds] = useState<string[]>([]);
  const [newOrderSignal, setNewOrderSignal] = useState(0);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch("/api/orders", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      const nextOrders = result.orders as Order[];
      const availableIds = new Set<string>(nextOrders.map((order) => order.id));
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

  async function updateStatus(id: string, status: string) {
    if (updatingIdsRef.current.has(id)) return;
    updatingIdsRef.current.add(id);
    setUpdatingIds([...updatingIdsRef.current]);
    setError("");

    try {
      const response = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error || "Không thể cập nhật trạng thái đơn");
      }
      await load(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể cập nhật trạng thái đơn");
    } finally {
      updatingIdsRef.current.delete(id);
      setUpdatingIds([...updatingIdsRef.current]);
    }
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
  const mobileOrders = orders.filter((order) => order.status === mobileTab);
  const mobileAllSelected = mobileOrders.length > 0 && mobileOrders.every((order) => selectedIds.includes(order.id));

  function selectMobileTab(status: OrderStatus) {
    mobileTabRef.current = status;
    setMobileTab(status);
  }

  return <main className="min-h-screen bg-[#fff7eb] text-[#2e201c]">
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-2xl bg-[#a82d1e] text-white"><Store /></div>
          <div><h1 className="font-black">MELI · Quản lý đơn</h1><p className="text-xs text-zinc-500">Xin chào, {ownerName}</p></div>
        </div>
        <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
          <Button variant="outline" size="icon" onClick={() => load()} aria-label="Làm mới"><RefreshCw /></Button>
          <Link href="/"><Button variant="outline"><span className="sm:hidden">Menu</span><span className="hidden sm:inline">Menu khách</span></Button></Link>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="bg-[#bd3b22] hover:bg-[#9e281c]"><Plus /> Tạo đơn</Button></DialogTrigger>
            <CreateOrderDialog menu={menu} onCreated={() => { setOpen(false); load(true); }} />
          </Dialog>
        </div>
      </div>
    </header>
    <section className="mx-auto max-w-[1500px] px-4 py-6">
      <div role="tablist" aria-label="Trạng thái đơn hàng" className="sticky top-0 z-20 -mx-4 mb-4 flex gap-2 overflow-x-auto border-y border-[#e9d7c5] bg-[#fff7eb]/95 px-4 py-3 backdrop-blur xl:hidden">
        {columns.map((column) => {
          const Icon = column.icon;
          const count = orders.filter((order) => order.status === column.id).length;
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
          }} className={`flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold ${column.id === "new" && newOrderSignal > 0 ? "animate-new-order" : ""} ${mobileTab === column.id ? "border-[#a82d1e] bg-[#a82d1e] text-white" : "border-[#e9d7c5] bg-white text-[#2e201c]"}`}>
            <Icon className="size-4" aria-hidden="true" />{column.title}<span className={`min-w-6 rounded-full px-1.5 py-0.5 text-center text-xs ${mobileTab === column.id ? "bg-white/20" : "bg-[#fff0df]"}`}>{count}</span>
          </button>;
        })}
      </div>
      <div className="mb-4 grid grid-cols-2 gap-2 sm:mb-6 sm:grid-cols-3 sm:gap-3">
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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-3 xl:hidden">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
          <Checkbox checked={mobileAllSelected} disabled={!mobileOrders.length || deleting} onCheckedChange={(checked) => setSelectedIds((current) => checked === true ? [...new Set([...current, ...mobileOrders.map((order) => order.id)])] : current.filter((id) => !mobileOrders.some((order) => order.id === id)))} aria-label={`Chọn tất cả đơn ${columns.find((column) => column.id === mobileTab)?.title}`} />
          Chọn trong tab ({mobileOrders.length})
        </label>
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && <span className="text-xs text-zinc-600">Đã chọn {selectedIds.length}</span>}
          <Button variant="destructive" size="sm" disabled={!selectedIds.length || deleting} onClick={() => requestDelete("bulk", selectedIds, `${selectedIds.length} đơn đã chọn`)}><Trash2 className="size-4" /> Xóa đã chọn</Button>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-4">
        {columns.map((column) => {
          const Icon = column.icon;
          const list = orders.filter((order) => order.status === column.id);
          return <div key={column.id} id={`order-panel-${column.id}`} role="tabpanel" aria-labelledby={`order-tab-${column.id}`} className={`min-h-64 rounded-3xl bg-[#eaede8] p-3 ${mobileTab === column.id ? "" : "hidden xl:block"}`}>
            <div className="mb-3 flex items-center justify-between px-2">
              <h2 className="flex items-center gap-2 font-black"><Icon className="size-4" />{column.title}</h2>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black">{list.length}</span>
            </div>
            <div className="space-y-3">
              {loading && !orders.length ? <div className="rounded-2xl bg-white p-5 text-sm text-zinc-500">Đang tải...</div> : !list.length ? <p className="rounded-2xl bg-white p-5 text-sm text-zinc-500">Chưa có đơn ở trạng thái này.</p> : list.map((order) =>
                <article key={order.id} className="rounded-2xl bg-white p-4 shadow-sm">
                  <div className="flex justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-[#9e281c]">{order.code} · {order.source === "staff_pos" ? "Chủ quán tạo" : "Khách tự đặt"}</p>
                      <h3 className="text-lg font-black">{order.tableCode ? `Bàn ${order.tableCode}` : "Mang về"}</h3>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <p className="min-w-0 truncate text-sm text-zinc-600">Khách: <span className="font-semibold text-[#2e201c]">{order.customerName?.trim() || "Chưa cung cấp"}</span></p>
                        {column.next && <Button size="sm" className="shrink-0 bg-[#a82d1e]" disabled={updatingIds.includes(order.id)} aria-busy={updatingIds.includes(order.id)} onClick={() => updateStatus(order.id, column.next)}>{updatingIds.includes(order.id) ? <><LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Đang cập nhật...</> : column.action}</Button>}
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <time dateTime={order.createdAt} title="Giờ Việt Nam" className="shrink-0 whitespace-pre-line text-right text-xs leading-5 text-zinc-500">{formatOrderTime(order.createdAt)}</time>
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
                      {["new", "cooking", "served"].includes(order.status) && order.paymentStatus !== "paid" && <Button variant="ghost" size="icon-sm" disabled={updatingIds.includes(order.id)} className="text-[#a82d1e] hover:bg-[#fff0df]" onClick={() => setEditTarget(order)} aria-label={`Sửa đơn ${order.code}`} title="Sửa đơn"><Pencil className="size-4" /></Button>}
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
    <Dialog open={editTarget !== null} onOpenChange={(next) => { if (!next && !savingEdit) setEditTarget(null); }}>
      {editTarget && <EditOrderDialog order={editTarget} menu={menu} onSavingChange={setSavingEdit} onClose={() => setEditTarget(null)} onSaved={() => { setEditTarget(null); void load(true); }} />}
    </Dialog>
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
          tableCode, customerName, note: composeOrderNote(notes, otherNote),
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
        <label className="space-y-1 text-sm font-semibold">Số bàn (để trống nếu mang về)
          <Input value={tableCode} maxLength={20} disabled={saving} onChange={(event) => setTableCode(event.target.value)} placeholder="Số bàn" />
        </label>
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
  const [cart, setCart] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<string[]>([]);
  const [otherNote, setOtherNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const selected = menu.filter((item) => cart[item.id]);
  const total = useMemo(() => selected.reduce((sum, item) => sum + item.price * cart[item.id], 0), [selected, cart]);

  function reset() {
    setTableCode("");
    setCart({});
    setNotes([]);
    setOtherNote("");
    setError("");
  }

  async function create() {
    if (saving || !selected.length) return;
    const normalizedTableCode = tableCode.trim();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: "staff_pos",
          tableCode: normalizedTableCode,
          orderType: normalizedTableCode ? "dine_in" : "takeaway",
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
      <DialogDescription>Chọn món và thêm thông tin bàn nếu cần.</DialogDescription>
    </DialogHeader>
    <Input value={tableCode} maxLength={20} disabled={saving} onChange={(event) => setTableCode(event.target.value)} placeholder="Số bàn — để trống nếu mang về" />
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
