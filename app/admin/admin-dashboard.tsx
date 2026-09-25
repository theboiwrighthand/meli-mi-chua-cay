"use client";

import { type CSSProperties, type Dispatch, type FormEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import { NavigationIconLink } from "@/components/navigation-icon-link";
import { ArrowLeft, ArrowRight, BarChart3, BookOpen, CalendarDays, Check, ChefHat, CircleCheck, ClipboardList, Clock3, CreditCard, Ellipsis, Eye, LoaderCircle, MapPin, Pencil, Play, Plus, RefreshCw, Search, Store, Table2, Trash2, Truck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney, type MenuItem } from "@/lib/menu";

type OrderItem = { id: number; menuItemId: string | null; itemName: string; price: number; quantity: number; notes: string };
type Order = { id: string; code: string; tableCode: string | null; orderType: string; source: string; status: string; customerName: string; note: string; total: number; paymentStatus: string; createdAt: string; items: OrderItem[] };
const columns = [
  { id: "new", statuses: ["new"], title: "Đơn mới", icon: Clock3, actionIcon: Play, action: "Bắt đầu làm", next: "cooking" },
  { id: "cooking", statuses: ["cooking", "served"], title: "Đã làm", icon: ChefHat, actionIcon: CreditCard, action: "Thanh toán", next: "paid" },
  { id: "paid", statuses: ["paid"], title: "Đã thanh toán", icon: CircleCheck, actionIcon: CircleCheck, action: "", next: "" },
] as const;
const quickNotes = ["Không hành", "Không giá đỗ", "Không rau", "Giảm cay"];
type OrderStatus = (typeof columns)[number]["id"];
type CountEffect = { change: number; sequence: number };
const StatsDialog = dynamic(() => import("./stats-dialog").then((module) => module.StatsDialog), { ssr: false });

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
  const [statsOpen, setStatsOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<OrderStatus>("new");
  const [search, setSearch] = useState("");
  const [areaFilter, setAreaFilter] = useState<"all" | "dine_in" | "takeaway">("all");
  const [timeFilter, setTimeFilter] = useState<"all" | "today" | "week">("all");
  const [now, setNow] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<{ kind: "single" | "bulk"; ids: string[]; label: string; confirmTitle?: string } | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [unpayTarget, setUnpayTarget] = useState<Order | null>(null);
  const [unpayLoading, setUnpayLoading] = useState(false);
  const [unpayError, setUnpayError] = useState("");
  const [bulkUnpayTarget, setBulkUnpayTarget] = useState<string[] | null>(null);
  const [bulkUnpayError, setBulkUnpayError] = useState("");
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [editTarget, setEditTarget] = useState<Order | null>(null);
  const [detailsTarget, setDetailsTarget] = useState<Order | null>(null);
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
      setNow(Date.now());
      setOrders(nextOrders);
      setSelectedIds((current) => current.filter((id) => availableIds.has(id)));
      if (hasNewOrder
        && window.matchMedia("(max-width: 1279px)").matches
        && mobileTabRef.current !== "new") {
        mobileTabRef.current = "new";
        setMobileTab("new");
        setSelectedIds([]);
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

  async function updateSelectedOrders(ids: string[], status: "new" | "cooking" | "paid", confirmUnpay = false): Promise<boolean> {
    if (!ids.length || ids.some((id) => updatingIdsRef.current.has(id))) return false;
    ids.forEach((id) => updatingIdsRef.current.add(id));
    setUpdatingIds([...updatingIdsRef.current]);
    setBulkUpdating(true);
    setError("");
    try {
      const response = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids, status, confirmUnpay }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || "Không thể cập nhật các đơn đã chọn");
      await load(true);
      setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể cập nhật các đơn đã chọn");
      return false;
    } finally {
      ids.forEach((id) => updatingIdsRef.current.delete(id));
      setUpdatingIds([...updatingIdsRef.current]);
      setBulkUpdating(false);
    }
  }

  async function confirmBulkUnpay() {
    if (!bulkUnpayTarget || bulkUpdating) return;
    setBulkUnpayError("");
    const success = await updateSelectedOrders(bulkUnpayTarget, "cooking", true);
    if (success) setBulkUnpayTarget(null);
    else setBulkUnpayError("Không thể chuyển các đơn đã chọn. Vui lòng tải lại và thử lại.");
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
      setSelectedIds((current) => current.filter((id) => !removedIds.has(id)));
      await load(true);
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Không thể xóa đơn hàng");
    } finally {
      setDeleting(false);
    }
  }

  const query = search.trim().toLocaleLowerCase("vi");
  const matchesSearch = (order: Order) => !query || [order.code, order.customerName, order.tableCode ?? "", ...order.items.map((item) => item.itemName)].some((value) => value.toLocaleLowerCase("vi").includes(query));
  const todayInVietnam = now ? formatOrderTime(new Date(now).toISOString()).split(" ")[0] : "";
  const matchesFilters = (order: Order) => matchesSearch(order)
    && (areaFilter === "all" || (areaFilter === "takeaway" ? order.orderType === "takeaway" : order.orderType !== "takeaway"))
    && (timeFilter === "all" || (timeFilter === "today"
      ? formatOrderTime(order.createdAt).startsWith(todayInVietnam)
      : new Date(order.createdAt).getTime() >= now - 7 * 24 * 60 * 60 * 1000));
  const visibleOrders = orders.filter((order) => columns.some((column) => column.statuses.some((status) => status === order.status)) && matchesFilters(order));
  const allSelected = visibleOrders.length > 0 && visibleOrders.every((order) => selectedIds.includes(order.id));
  const mobileOrders = orders.filter((order) => columns.find((column) => column.id === mobileTab)?.statuses.some((status) => status === order.status) && matchesFilters(order));
  const mobileAllSelected = mobileOrders.length > 0 && mobileOrders.every((order) => selectedIds.includes(order.id));
  const selectedInTab = mobileOrders.filter((order) => selectedIds.includes(order.id)).map((order) => order.id);
  const selectedBusy = bulkUpdating || deleting || selectedInTab.some((id) => updatingIds.includes(id));

  function selectMobileTab(status: OrderStatus) {
    if (status !== mobileTabRef.current) setSelectedIds([]);
    mobileTabRef.current = status;
    setMobileTab(status);
  }

  return <main className="meli-admin-page min-h-screen overflow-x-clip bg-[#f6f6f7] text-[#303030]">
    <aside className="meli-admin-sidebar hidden xl:flex" aria-label="Điều hướng quản lý">
      <div className="meli-admin-sidebar-brand"><span className="meli-admin-sidebar-mark"><ClipboardList className="size-5" /></span><span>MELI<small>Quản lý quán</small></span></div>
      <div className="meli-admin-sidebar-section">QUẢN LÝ</div>
      <div className="meli-admin-sidebar-active"><ClipboardList className="size-4" /> Đơn hàng</div>
      <NavigationIconLink href="/" className="meli-admin-sidebar-link" label="Mở menu khách"><BookOpen className="size-4" /><span>Menu khách</span></NavigationIconLink>
      <div className="meli-admin-sidebar-bottom">Xin chào, {ownerName}</div>
    </aside>
    <header className="meli-admin-shell border-b border-[#e1e3e5] bg-white">
      <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-2 px-3 py-3 sm:gap-3 sm:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <NavigationIconLink href="/" className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#a82d1e] text-white transition-colors hover:bg-[#89291d] xl:hidden" label="Về menu đặt món"><ClipboardList className="size-5" /></NavigationIconLink>
          <div className="min-w-0"><h1 className="truncate text-base font-bold sm:text-lg xl:text-xl">Đơn hàng</h1><p className="truncate text-xs text-zinc-500 sm:text-sm">MELI · Xin chào, {ownerName}</p></div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <Button variant="outline" size="icon" className="size-9 rounded-lg border-[#e1e3e5] bg-white text-[#303030] hover:bg-[#f6f6f7] sm:size-10" onClick={() => setStatsOpen(true)} aria-label="Xem thống kê" title="Xem thống kê"><BarChart3 className="size-5" /></Button>
          <Button variant="outline" size="icon" className="size-9 rounded-lg border-[#e1e3e5] bg-white hover:bg-[#f6f6f7] sm:size-10" onClick={() => load()} aria-label="Làm mới"><RefreshCw className="size-4" /></Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="h-9 rounded-lg bg-[#b92717] px-2.5 text-xs font-bold hover:bg-[#9e281c] sm:h-11 sm:px-4 sm:text-sm"><Plus className="size-4" /> Tạo đơn</Button></DialogTrigger>
            <CreateOrderDialog menu={menu} onCreated={() => { setOpen(false); load(true); }} />
          </Dialog>
        </div>
      </div>
    </header>
    {statsOpen && <StatsDialog onOpenChange={setStatsOpen} />}
    <section className="meli-admin-shell mx-auto min-w-0 max-w-[1700px] px-4 py-4 sm:px-6 sm:py-6">
      <div role="tablist" aria-label="Trạng thái đơn hàng" className="sticky top-0 z-20 -mx-4 mb-4 grid grid-cols-3 gap-2 border-y border-[#e1e3e5] bg-[#f6f6f7] px-4 py-3 xl:hidden">
        {columns.map((column) => {
          const Icon = column.icon;
          const count = orders.filter((order) => column.statuses.some((status) => status === order.status)).length;
          return <button key={column.id} id={`order-tab-${column.id}`} type="button" role="tab" disabled={bulkUpdating || deleting} tabIndex={mobileTab === column.id ? 0 : -1} aria-controls={`order-panel-${column.id}`} aria-selected={mobileTab === column.id} onClick={() => selectMobileTab(column.id)} onKeyDown={(event) => {
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
          }} className={`flex min-w-0 items-center justify-between gap-1 rounded-lg border px-2 py-2.5 text-xs font-bold sm:justify-start sm:gap-2 sm:px-3 sm:text-sm ${column.id === "new" && newOrderSignal > 0 ? "animate-new-order" : ""} ${mobileTab === column.id ? {
            new: "border-[#d8a6a0] bg-[#fff5f4] text-[#a82d1e]",
            cooking: "border-[#dbc797] bg-[#fffaee] text-[#955c0d]",
            paid: "border-[#a9d6bd] bg-[#effaf4] text-[#166b46]",
          }[column.id] : "border-[#e1e3e5] bg-[#f6f6f7] text-[#303030]"}`}>
            <Icon className="hidden size-4 shrink-0 sm:block" aria-hidden="true" /><span className="min-w-0 truncate">{column.title}</span><OrderCountBadge count={count} effect={countEffects[column.id]} active={mobileTab === column.id} />
          </button>;
        })}
      </div>
      {error && <p className="mb-5 rounded-2xl bg-red-50 p-4 text-red-700">{error}</p>}
      <div className="mb-4 flex min-w-0 items-center gap-2 sm:hidden" role="group" aria-label="Tìm kiếm và lọc đơn hàng">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
          <Input value={search} onChange={(event) => { setSearch(event.target.value); setSelectedIds([]); }} placeholder="Tìm đơn, món..." aria-label="Tìm mã đơn, khách, bàn hoặc món" className="h-11 w-full rounded-[10px] border-[#e1e3e5] bg-white pl-9 text-sm" />
        </label>
        <DropdownMenuPrimitive.Root>
          <DropdownMenuPrimitive.Trigger asChild><Button type="button" variant="outline" size="icon" className={`size-11 shrink-0 rounded-[10px] ${timeFilter !== "all" ? "border-[#b44b31] bg-[#fff8f3] text-[#a82d1e]" : "border-[#e1e3e5] bg-white text-[#57575e]"}`} aria-label={`Lọc thời gian: ${timeFilter === "today" ? "Hôm nay" : timeFilter === "week" ? "7 ngày qua" : "Mọi ngày"}`} title="Lọc theo thời gian"><CalendarDays className="size-5" aria-hidden="true" /></Button></DropdownMenuPrimitive.Trigger>
          <DropdownMenuPrimitive.Portal><DropdownMenuPrimitive.Content align="end" sideOffset={8} className="z-50 min-w-44 rounded-lg border border-[#e1e3e5] bg-white p-1 text-sm shadow-lg outline-none">
            <DropdownMenuPrimitive.RadioGroup value={timeFilter} onValueChange={(value) => { setTimeFilter(value as typeof timeFilter); setSelectedIds([]); }}>
              {[["all", "Mọi ngày"], ["today", "Hôm nay"], ["week", "7 ngày qua"]].map(([value, label]) => <DropdownMenuPrimitive.RadioItem key={value} value={value} className="flex cursor-pointer items-center justify-between rounded-md px-3 py-2.5 outline-none hover:bg-[#f6f6f7] focus:bg-[#f6f6f7] data-[state=checked]:font-semibold data-[state=checked]:text-[#a82d1e]">{label}<DropdownMenuPrimitive.ItemIndicator><Check className="size-4" /></DropdownMenuPrimitive.ItemIndicator></DropdownMenuPrimitive.RadioItem>)}
            </DropdownMenuPrimitive.RadioGroup>
          </DropdownMenuPrimitive.Content></DropdownMenuPrimitive.Portal>
        </DropdownMenuPrimitive.Root>
        <DropdownMenuPrimitive.Root>
          <DropdownMenuPrimitive.Trigger asChild><Button type="button" variant="outline" size="icon" className={`size-11 shrink-0 rounded-[10px] ${areaFilter !== "all" ? "border-[#b44b31] bg-[#fff8f3] text-[#a82d1e]" : "border-[#e1e3e5] bg-white text-[#57575e]"}`} aria-label={`Lọc khu vực: ${areaFilter === "takeaway" ? "Mang về" : areaFilter === "dine_in" ? "Tại quán" : "Mọi khu vực"}`} title="Lọc theo khu vực"><MapPin className="size-5" aria-hidden="true" /></Button></DropdownMenuPrimitive.Trigger>
          <DropdownMenuPrimitive.Portal><DropdownMenuPrimitive.Content align="end" sideOffset={8} className="z-50 min-w-44 rounded-lg border border-[#e1e3e5] bg-white p-1 text-sm shadow-lg outline-none">
            <DropdownMenuPrimitive.RadioGroup value={areaFilter} onValueChange={(value) => { setAreaFilter(value as typeof areaFilter); setSelectedIds([]); }}>
              {[["all", "Mọi khu vực"], ["dine_in", "Tại quán"], ["takeaway", "Mang về"]].map(([value, label]) => <DropdownMenuPrimitive.RadioItem key={value} value={value} className="flex cursor-pointer items-center justify-between rounded-md px-3 py-2.5 outline-none hover:bg-[#f6f6f7] focus:bg-[#f6f6f7] data-[state=checked]:font-semibold data-[state=checked]:text-[#a82d1e]">{label}<DropdownMenuPrimitive.ItemIndicator><Check className="size-4" /></DropdownMenuPrimitive.ItemIndicator></DropdownMenuPrimitive.RadioItem>)}
            </DropdownMenuPrimitive.RadioGroup>
          </DropdownMenuPrimitive.Content></DropdownMenuPrimitive.Portal>
        </DropdownMenuPrimitive.Root>
      </div>
      <div className="meli-admin-filterbar mb-4 hidden flex-wrap items-center gap-3 rounded-lg border border-[#e1e3e5] bg-white p-3 sm:flex">
        <label className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
          <Input value={search} onChange={(event) => { setSearch(event.target.value); setSelectedIds([]); }} placeholder="Tìm đơn, khách, bàn, món..." aria-label="Tìm trong danh sách đơn" className="h-10 w-full border-[#e1e3e5] bg-white pl-9" />
        </label>
        <label className="meli-admin-select relative flex min-w-0 sm:min-w-[142px] sm:flex-none"><MapPin className="pointer-events-none absolute left-3 top-1/2 hidden size-4 -translate-y-1/2 text-zinc-500 sm:block" aria-hidden="true" />
          <span className="sr-only">Khu vực đơn</span>
          <select value={areaFilter} onChange={(event) => { setAreaFilter(event.target.value as typeof areaFilter); setSelectedIds([]); }} className="h-10 w-full appearance-none rounded-md border border-[#e1e3e5] bg-white pl-2.5 pr-6 text-[13px] text-[#303030] sm:pl-9 sm:pr-7 sm:text-sm"><option value="all">Mọi khu vực</option><option value="dine_in">Tại quán</option><option value="takeaway">Mang về</option></select>
        </label>
        <label className="meli-admin-select relative flex min-w-0 sm:min-w-[142px] sm:flex-none"><Clock3 className="pointer-events-none absolute left-3 top-1/2 hidden size-4 -translate-y-1/2 text-zinc-500 sm:block" aria-hidden="true" />
          <span className="sr-only">Thời gian đặt đơn</span>
          <select value={timeFilter} onChange={(event) => { setTimeFilter(event.target.value as typeof timeFilter); setSelectedIds([]); }} className="h-10 w-full appearance-none rounded-md border border-[#e1e3e5] bg-white pl-2.5 pr-6 text-[13px] text-[#303030] sm:pl-9 sm:pr-7 sm:text-sm"><option value="all">Mọi ngày</option><option value="today">Hôm nay</option><option value="week">7 ngày qua</option></select>
        </label>
        <div className="hidden items-center gap-3 xl:flex">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
          <Checkbox checked={allSelected} disabled={!visibleOrders.length || deleting || bulkUpdating} onCheckedChange={(checked) => setSelectedIds(checked === true ? visibleOrders.map((order) => order.id) : [])} aria-label="Chọn tất cả đơn" />
          Chọn tất cả ({visibleOrders.length})
        </label>
        <div className="flex items-center gap-3">
          {selectedIds.length > 0 && <span className="text-sm text-zinc-600">Đã chọn {selectedIds.length} đơn</span>}
          <Button variant="destructive" size="sm" disabled={!selectedIds.length || deleting || bulkUpdating} onClick={() => requestDelete("bulk", selectedIds, `${selectedIds.length} đơn đã chọn`)}>
            <Trash2 className="size-4" /> Xóa đã chọn
          </Button>
        </div>
        </div>
      </div>
      <div className="mb-3 min-w-0 px-1 xl:hidden">
        <div className="flex min-h-9 items-center justify-end gap-2">
          {selectedInTab.length > 0 && <span className="mr-auto rounded-full bg-[#fff0df] px-2 py-0.5 text-[11px] text-[#a82d1e]">Đã chọn {selectedInTab.length}</span>}
          <label className="ml-auto inline-flex cursor-pointer items-center gap-2 whitespace-nowrap text-xs font-semibold text-[#594b44]">
            <Checkbox checked={mobileAllSelected} disabled={!mobileOrders.length || deleting || bulkUpdating} onCheckedChange={(checked) => setSelectedIds((current) => checked === true ? mobileOrders.map((order) => order.id) : current.filter((id) => !mobileOrders.some((order) => order.id === id)))} aria-label={`Chọn tất cả đơn ${columns.find((column) => column.id === mobileTab)?.title}`} />
            <span>Chọn tất cả <span className="text-zinc-500">({mobileOrders.length})</span></span>
          </label>
        </div>
        {selectedInTab.length > 0 && <div className={`mt-2 grid gap-1.5 ${mobileTab === "cooking" ? "grid-cols-3" : "grid-cols-2"}`}>
          {mobileTab === "cooking" && <Button variant="outline" size="sm" className="h-10 min-w-0 gap-1 rounded-lg px-1 text-[11px] sm:text-xs" disabled={selectedBusy} onClick={() => void updateSelectedOrders(selectedInTab, "new")}><ArrowLeft className="size-3 shrink-0" /> Đơn mới</Button>}
          <Button variant="destructive" size="sm" className="h-10 min-w-0 gap-1 rounded-lg px-1 text-[11px] sm:text-xs" disabled={selectedBusy} onClick={() => requestDelete("bulk", selectedInTab, `${selectedInTab.length} đơn đã chọn`, mobileTab === "paid" ? "Xóa các đơn đã thanh toán này?" : undefined)}><Trash2 className="size-3 shrink-0" /> Xóa ({selectedInTab.length})</Button>
          {mobileTab === "new" && <Button variant="outline" size="sm" className="h-10 min-w-0 gap-1 rounded-lg px-1 text-[11px] sm:text-xs" disabled={selectedBusy} onClick={() => void updateSelectedOrders(selectedInTab, "cooking")}><ArrowRight className="size-3 shrink-0" /> Đã làm</Button>}
          {mobileTab === "cooking" && <Button variant="outline" size="sm" className="h-10 min-w-0 gap-1 rounded-lg px-1 text-[11px] sm:text-xs" disabled={selectedBusy} onClick={() => void updateSelectedOrders(selectedInTab, "paid")}><ArrowRight className="size-3 shrink-0" /> Thanh toán</Button>}
          {mobileTab === "paid" && <Button variant="outline" size="sm" className="h-10 min-w-0 gap-1 rounded-lg px-1 text-[11px] sm:text-xs" disabled={selectedBusy} onClick={() => { setBulkUnpayError(""); setBulkUnpayTarget([...selectedInTab]); }}><ArrowLeft className="size-3 shrink-0" /> Chưa thanh toán</Button>}
        </div>}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        {columns.map((column) => {
          const Icon = column.icon;
          const ActionIcon = column.actionIcon;
          const list = orders.filter((order) => column.statuses.some((status) => status === order.status) && matchesFilters(order));
          return <div key={column.id} id={`order-panel-${column.id}`} role="tabpanel" aria-labelledby={`order-tab-${column.id}`} className={`meli-admin-column meli-admin-column-${column.id} min-h-64 min-w-0 rounded-xl border border-[#e1e3e5] p-2 sm:p-3 ${mobileTab === column.id ? "" : "hidden xl:block"}`}>
            <div className="mb-3 flex items-center justify-between px-2">
              <h2 className="flex items-center gap-2 font-black"><Icon className="size-4" />{column.title}</h2>
              <OrderCountBadge count={list.length} effect={countEffects[column.id]} desktop />
            </div>
            <div className="mb-2 flex items-center justify-between gap-2 px-2 text-[11px] font-semibold text-zinc-600 xl:hidden">
              <span className="inline-flex min-w-0 items-center gap-1 text-left"><ArrowLeft className="size-3.5 shrink-0" aria-hidden="true" />{column.id === "new" ? "Xóa đơn" : column.id === "cooking" ? "Đơn mới" : "Chưa thanh toán"}</span>
              <span className="inline-flex min-w-0 items-center gap-1 text-right">{column.id === "new" ? "Đã làm" : column.id === "cooking" ? "Thanh toán" : "Xóa đơn"}<ArrowRight className="size-3.5 shrink-0" aria-hidden="true" /></span>
            </div>
            <div className="space-y-3">
              {loading && !orders.length ? <div className="rounded-2xl bg-white p-5 text-sm text-zinc-500">Đang tải...</div> : !list.length ? <p className="rounded-2xl bg-white p-5 text-sm text-zinc-500">Chưa có đơn ở trạng thái này.</p> : list.map((order) =>
                <SwipeableOrderCard key={order.id} order={order} busy={updatingIds.includes(order.id) || deleting} loading={updatingIds.includes(order.id) || (deleting && deleteTarget?.ids.includes(order.id) === true)} onSwipe={handleSwipe}>
                <article className="meli-admin-order-card min-w-0 overflow-hidden rounded-lg border border-[#d9dcdf] bg-white shadow-sm">
                  <div className="p-3 sm:p-4">
                    <div className="flex min-w-0 items-start gap-2">
                      <Checkbox className="mt-0.5 size-4 shrink-0 border-[#a82d1e] data-[state=checked]:border-[#a82d1e] data-[state=checked]:bg-[#a82d1e]" checked={selectedIds.includes(order.id)} disabled={bulkUpdating || deleting} onCheckedChange={(checked) => setSelectedIds((current) => checked === true ? [...current, order.id] : current.filter((id) => id !== order.id))} aria-label={`Chọn đơn ${order.code}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-1">
                          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                            <h3 className="min-w-0 break-all text-sm font-bold leading-tight">{order.code}</h3>
                            <time dateTime={order.createdAt} title="Giờ Việt Nam" className="shrink-0 text-[11px] tabular-nums text-[#616161]">{formatOrderTime(order.createdAt)}</time>
                          </div>
                          <DropdownMenuPrimitive.Root>
                            <DropdownMenuPrimitive.Trigger asChild><Button variant="ghost" size="icon-sm" className="-mr-1 -mt-1 shrink-0 text-[#454545]" disabled={updatingIds.includes(order.id) || deleting} aria-label={`Tùy chọn đơn ${order.code}`} title="Tùy chọn đơn"><Ellipsis className="size-5" /></Button></DropdownMenuPrimitive.Trigger>
                            <DropdownMenuPrimitive.Portal>
                              <DropdownMenuPrimitive.Content align="end" sideOffset={5} className="z-50 min-w-40 rounded-lg border border-[#e1e3e5] bg-white p-1 text-sm shadow-lg outline-none">
                                <DropdownMenuPrimitive.Item onSelect={() => setDetailsTarget(order)} className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 outline-none hover:bg-[#f6f6f7] focus:bg-[#f6f6f7]"><Eye className="size-4" /> Xem chi tiết</DropdownMenuPrimitive.Item>
                                {["new", "cooking", "served"].includes(order.status) && order.paymentStatus !== "paid" && <DropdownMenuPrimitive.Item onSelect={() => setEditTarget(order)} className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 outline-none hover:bg-[#f6f6f7] focus:bg-[#f6f6f7]"><Pencil className="size-4" /> Sửa đơn</DropdownMenuPrimitive.Item>}
                                <DropdownMenuPrimitive.Separator className="my-1 h-px bg-[#e1e3e5]" />
                                <DropdownMenuPrimitive.Item onSelect={() => requestDelete("single", [order.id], `đơn ${order.code}`, order.status === "paid" ? "Xóa đơn đã thanh toán này" : undefined)} className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-[#b42318] outline-none hover:bg-[#fff0ee] focus:bg-[#fff0ee]"><Trash2 className="size-4" /> Xóa đơn</DropdownMenuPrimitive.Item>
                              </DropdownMenuPrimitive.Content>
                            </DropdownMenuPrimitive.Portal>
                          </DropdownMenuPrimitive.Root>
                        </div>
                        <p className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 break-words text-xs text-[#454545]">
                          <span className="inline-flex items-center gap-1"><UserRound className="size-3.5 shrink-0" aria-hidden="true" />{order.customerName?.trim() || (order.source === "staff_pos" ? "Chủ quán tạo" : "Khách tự đặt")}</span>
                          <span className="text-[#9a9a9a]">·</span>
                          <span className="inline-flex items-center gap-1">{order.orderType === "takeaway" ? <Truck className="size-3.5 shrink-0" aria-hidden="true" /> : <Table2 className="size-3.5 shrink-0" aria-hidden="true" />}{order.orderType === "takeaway" ? "Mang về" : order.tableCode ? `Bàn ${order.tableCode}` : "Dùng tại chỗ"}</span>
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 space-y-1.5">{order.items.map((item) =>
                      <div key={item.id} className="flex min-w-0 items-start justify-between gap-2 text-sm">
                        <span className="min-w-0 break-words"><b className="mr-1.5 font-medium tabular-nums">{item.quantity}×</b>{item.itemName}{item.notes?.trim() && <span className="ml-1 text-[.78em] font-normal text-zinc-500">({item.notes.trim()})</span>}</span>
                        <span className="shrink-0 tabular-nums">{formatMoney(item.price * item.quantity)}</span>
                      </div>
                    )}</div>
                    {order.note && <p className="mt-2 break-words rounded-md bg-[#f6f6f7] px-2.5 py-2 text-xs text-[#454545]"><b>Ghi chú:</b> {order.note}</p>}
                    <div className="mt-3 flex items-center justify-between border-t border-[#e1e3e5] pt-2.5 text-sm"><span>Tổng cộng</span><strong className="tabular-nums">{formatMoney(order.total)}</strong></div>
                    <div className="mt-3 flex min-w-0 items-center justify-between gap-2">
                      <span className={`inline-flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium ${column.id === "new" ? "bg-[#fff0ee] text-[#a82d1e]" : column.id === "cooking" ? "bg-[#fff5df] text-[#956112]" : "bg-[#e7f7ed] text-[#16734a]"}`}>
                        <span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />{column.title}
                      </span>
                      {column.next && <Button size="sm" className="h-9 shrink-0 rounded-md bg-[#a82d1e] px-2.5 text-xs font-semibold hover:bg-[#89291d]" disabled={updatingIds.includes(order.id)} aria-busy={updatingIds.includes(order.id)} onClick={() => updateStatus(order.id, column.next)}>{updatingIds.includes(order.id) ? <><LoaderCircle className="size-4 animate-spin" aria-hidden="true" /><span className="sr-only">Đang cập nhật...</span></> : <><ActionIcon className="size-4" />{column.action}</>}</Button>}
                    </div>
                  </div>
                </article>
                </SwipeableOrderCard>
              )}
            </div>
          </div>;
        })}
      </div>
    </section>
    <div className="meli-admin-mobile-cta fixed inset-x-0 bottom-0 z-30 border-t border-[#e1e3e5] bg-white px-4 pb-[calc(.75rem+env(safe-area-inset-bottom))] pt-3 sm:hidden">
      <Button onClick={() => setOpen(true)} className="h-11 w-full rounded-md bg-[#a82d1e] font-semibold hover:bg-[#89291d]"><Plus className="size-4" /> Tạo đơn mới</Button>
    </div>
    <Dialog open={detailsTarget !== null} onOpenChange={(next) => { if (!next) setDetailsTarget(null); }}>
      {detailsTarget && <DialogContent className="max-h-[90dvh] w-[calc(100%-1.5rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="pr-8 text-left">
          <DialogTitle>Chi tiết đơn {detailsTarget.code}</DialogTitle>
          <DialogDescription>Đặt lúc {formatOrderTime(detailsTarget.createdAt)} · {detailsTarget.source === "staff_pos" ? "Chủ quán tạo" : "Khách tự đặt"}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3 rounded-lg bg-[#f6f6f7] p-3">
            <div><p className="text-xs text-zinc-500">Khách</p><p className="font-semibold">{detailsTarget.customerName?.trim() || "Chưa cung cấp"}</p></div>
            <div><p className="text-xs text-zinc-500">Hình thức</p><p className="font-semibold">{detailsTarget.orderType === "takeaway" ? "Mang về" : detailsTarget.tableCode ? `Bàn ${detailsTarget.tableCode}` : "Dùng tại chỗ"}</p></div>
            <div><p className="text-xs text-zinc-500">Trạng thái</p><p className="font-semibold">{columns.find((column) => column.statuses.some((status) => status === detailsTarget.status))?.title ?? detailsTarget.status}</p></div>
            <div><p className="text-xs text-zinc-500">Thanh toán</p><p className="font-semibold">{detailsTarget.paymentStatus === "paid" ? "Đã thanh toán" : "Chưa thanh toán"}</p></div>
          </div>
          <div><h3 className="mb-2 font-semibold">Các món đã chọn</h3><ul className="divide-y border-y border-[#e1e3e5]">{detailsTarget.items.map((item) => <li key={item.id} className="flex items-start justify-between gap-3 py-2.5"><span className="min-w-0">{item.quantity}× {item.itemName}{item.notes?.trim() && <small className="ml-1 text-zinc-500">({item.notes.trim()})</small>}</span><strong className="shrink-0 tabular-nums">{formatMoney(item.price * item.quantity)}</strong></li>)}</ul></div>
          {detailsTarget.note && <p className="rounded-lg bg-[#fff5eb] p-3"><strong>Ghi chú:</strong> {detailsTarget.note}</p>}
          <div className="flex justify-between border-t pt-3 text-base"><span>Tổng cộng</span><strong className="tabular-nums text-[#a82d1e]">{formatMoney(detailsTarget.total)}</strong></div>
        </div>
      </DialogContent>}
    </Dialog>
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
    <Dialog open={bulkUnpayTarget !== null} onOpenChange={(next) => { if (!next && !bulkUpdating) { setBulkUnpayTarget(null); setBulkUnpayError(""); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Chuyển {bulkUnpayTarget?.length} đơn thành chưa thanh toán?</DialogTitle>
          <DialogDescription>Các đơn đã chọn sẽ trở lại tab Đã làm và không còn được tính là đã thanh toán.</DialogDescription>
        </DialogHeader>
        {bulkUnpayError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{bulkUnpayError}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={bulkUpdating} onClick={() => setBulkUnpayTarget(null)}>Không, giữ lại</Button>
          <Button disabled={bulkUpdating} onClick={() => void confirmBulkUnpay()}>{bulkUpdating ? "Đang chuyển..." : "Đồng ý chuyển"}</Button>
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
    <span aria-live="polite" aria-atomic="true" className={`relative min-w-6 rounded-full text-center font-black ${desktop ? "bg-white px-2.5 py-1 text-xs" : `px-1.5 py-0.5 text-xs ${active ? "bg-white/20" : "bg-[#fff0df]"}`} ${effect?.change && effect.change > 0 ? "order-count-up" : effect?.change ? "order-count-down" : ""}`}>{count}</span>
    {effect && <span key={effect.sequence} aria-hidden="true" className="pointer-events-none absolute inset-0">
      {effect.change > 0 ? confettiVectors.map(([dx, dy], index) =>
        <i key={index} className="order-count-confetti" style={{
          "--dx": `${dx}px`, "--dy": `${dy}px`, backgroundColor: confettiColors[index],
        } as CSSProperties} />
      ) : <span className="order-count-minus" title={`Giảm ${Math.abs(effect.change)} đơn`}>−</span>}
    </span>}
  </span>;
}

type EditLine = {
  key: string;
  existingId?: number;
  menuItemId?: string | null;
  name: string;
  price: number;
  quantity: number;
  notes: string[];
  otherNote: string;
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
    notes: parseOrderNote(item.notes).notes, otherNote: parseOrderNote(item.notes).otherNote,
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
        notes: [], otherNote: "",
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
          items: lines.map((line) => ({
            ...(line.existingId ? { id: line.existingId } : { menuItemId: line.menuItemId }),
            quantity: line.quantity,
            notes: [...line.notes, line.otherNote.trim()].filter(Boolean),
          })),
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
          {lines.map((line) => <div key={line.key} className="rounded-xl border p-2">
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{line.name}</p>
                <p className="text-xs text-zinc-500">{formatMoney(line.price)} / món</p>
              </div>
              <Button type="button" size="icon-sm" variant="outline" disabled={saving || line.quantity <= 1} onClick={() => changeQuantity(line.key, -1)} aria-label={`Giảm ${line.name}`}>−</Button>
              <span className="w-5 text-center text-sm font-bold">{line.quantity}</span>
              <Button type="button" size="icon-sm" variant="outline" disabled={saving || line.quantity >= 20} onClick={() => changeQuantity(line.key, 1)} aria-label={`Thêm ${line.name}`}>+</Button>
              <Button type="button" size="icon-sm" variant="ghost" disabled={saving} onClick={() => setLines((current) => current.filter((entry) => entry.key !== line.key))} aria-label={`Bỏ ${line.name}`} className="text-red-700"><Trash2 className="size-4" /></Button>
            </div>
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer font-semibold text-[#a82d1e]">Ghi chú riêng{line.notes.length || line.otherNote ? " · Đã chọn" : ""}</summary>
              <fieldset disabled={saving} className="mt-2 flex flex-wrap gap-2" aria-label={`Yêu cầu riêng cho ${line.name}`}>
                {quickNotes.map((note) => <label key={note} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border bg-white px-2 text-xs">
                  <Checkbox checked={line.notes.includes(note)} onCheckedChange={(checked) => setLines((current) => current.map((entry) => entry.key === line.key ? { ...entry, notes: checked ? [...entry.notes, note] : entry.notes.filter((value) => value !== note) } : entry))} />{note}
                </label>)}
              </fieldset>
              <Input className="mt-2 h-10" aria-label={`Ghi chú khác cho ${line.name}`} placeholder="Ghi chú khác cho món này..." maxLength={200} disabled={saving} value={line.otherNote} onChange={(event) => setLines((current) => current.map((entry) => entry.key === line.key ? { ...entry, otherNote: event.target.value } : entry))} />
            </details>
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
      <legend className="mb-2 text-sm font-bold">Yêu cầu chung</legend>
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
  const [itemNotes, setItemNotes] = useState<Record<string, string[]>>({});
  const [itemOtherNotes, setItemOtherNotes] = useState<Record<string, string>>({});
  const [menuSearch, setMenuSearch] = useState("");
  const [menuCategory, setMenuCategory] = useState<"all" | MenuItem["category"]>("all");
  const [notes, setNotes] = useState<string[]>([]);
  const [otherNote, setOtherNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const selected = menu.filter((item) => cart[item.id]);
  const itemCount = selected.reduce((sum, item) => sum + cart[item.id], 0);
  const filteredMenu = menu.filter((item) => (menuCategory === "all" || item.category === menuCategory)
    && item.name.toLocaleLowerCase("vi").includes(menuSearch.trim().toLocaleLowerCase("vi")));
  const total = useMemo(() => selected.reduce((sum, item) => sum + item.price * cart[item.id], 0), [selected, cart]);

  function reset() {
    setTableCode("");
    setIsTakeaway(false);
    setCart({});
    setItemNotes({});
    setItemOtherNotes({});
    setMenuSearch("");
    setMenuCategory("all");
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
          items: selected.map((item) => ({ id: item.id, quantity: cart[item.id], notes: [...(itemNotes[item.id] ?? []), itemOtherNotes[item.id]?.trim()].filter(Boolean) })),
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

  return <DialogContent className="meli-admin-create-sheet flex max-h-[92dvh] min-h-0 w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden bg-[#fffaf3] p-0 max-sm:translate-x-0 max-sm:translate-y-0 sm:max-w-3xl" onOpenAutoFocus={(event) => { event.preventDefault(); titleRef.current?.focus(); }}>
    <DialogHeader className="shrink-0 border-b border-[#eed9c8] bg-white px-4 py-4 pr-14 text-left sm:px-6">
      <DialogTitle ref={titleRef} tabIndex={-1} className="text-xl font-black text-[#321e18] outline-none sm:text-2xl">Tạo đơn tại quầy</DialogTitle>
      <DialogDescription className="text-sm">{itemCount ? `${itemCount} món đã chọn` : "Chọn món cho khách"}</DialogDescription>
    </DialogHeader>
    <div className="min-h-0 min-w-0 flex-1 space-y-5 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
      <section aria-label="Thông tin đơn" className="space-y-3 rounded-xl border border-[#edddce] bg-white p-3 sm:p-4">
        <h3 className="text-sm font-bold text-[#47372f]">Hình thức dùng món</h3>
        <div role="group" aria-label="Hình thức dùng món" className="grid grid-cols-2 gap-2">
          <button type="button" aria-pressed={!isTakeaway} disabled={saving} onClick={() => setIsTakeaway(false)} className={`flex min-h-12 items-center justify-center gap-2 rounded-lg border px-2 text-sm font-bold transition-colors ${!isTakeaway ? "border-[#a82d1e] bg-[#fff0e7] text-[#8e2b1c] ring-1 ring-[#a82d1e]" : "border-[#e8d6c7] bg-white text-[#69564d] hover:bg-[#fff7f0]"}`}><Store aria-hidden="true" className="size-5 shrink-0" />Ăn tại quán</button>
          <button type="button" aria-pressed={isTakeaway} disabled={saving} onClick={() => { setIsTakeaway(true); setTableCode(""); }} className={`flex min-h-12 items-center justify-center gap-2 rounded-lg border px-2 text-sm font-bold transition-colors ${isTakeaway ? "border-[#a82d1e] bg-[#fff0e7] text-[#8e2b1c] ring-1 ring-[#a82d1e]" : "border-[#e8d6c7] bg-white text-[#69564d] hover:bg-[#fff7f0]"}`}><Truck aria-hidden="true" className="size-5 shrink-0" />Mang về</button>
        </div>
        {!isTakeaway && <label className="block text-sm font-semibold text-[#47372f]">Số bàn <span className="font-normal text-zinc-500">(tuỳ chọn)</span>
          <Input className="mt-1.5 h-11 bg-white" value={tableCode} maxLength={20} disabled={saving} onChange={(event) => setTableCode(event.target.value)} placeholder="Ví dụ: 3" />
        </label>}
      </section>
      {selected.length > 0 && <section aria-label="Các món đã chọn" className="rounded-xl border border-[#ddad91] bg-[#fff1e6] p-3">
        <div className="mb-1 flex items-center gap-2 text-sm font-black text-[#8d281d]"><Check aria-hidden="true" className="size-4" />Các món đã chọn <span className="ml-auto font-semibold">{itemCount} món</span></div>
        <p className="mb-2 text-xs text-[#795447]">{isTakeaway ? "Mang về" : tableCode.trim() ? `Bàn ${tableCode.trim()}` : "Ăn tại quán"}</p>
        <div className="divide-y divide-[#e9cbb8] border-t border-[#e9cbb8]">
          {selected.map((item) => {
            const itemNote = [...(itemNotes[item.id] ?? []), itemOtherNotes[item.id]?.trim()].filter(Boolean).join(", ");
            return <div key={item.id} className="flex min-w-0 items-start justify-between gap-3 py-2 text-sm">
              <div className="min-w-0"><p className="font-semibold"><span className="text-[#a82d1e]">{cart[item.id]}×</span> {item.name}</p>{itemNote && <p className="mt-0.5 break-words text-xs text-[#795447]">({itemNote})</p>}</div>
              <span className="shrink-0 font-semibold tabular-nums">{formatMoney(item.price * cart[item.id])}</span>
            </div>;
          })}
        </div>
      </section>}
      <section aria-label="Chọn món" className="space-y-3">
        <div className="flex items-center justify-between gap-2"><h3 className="text-base font-black">Chọn món</h3><span className="text-sm text-zinc-500">{filteredMenu.length} món</span></div>
        <div className="relative"><Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" /><Input className="h-11 bg-white pl-9" value={menuSearch} disabled={saving} onChange={(event) => setMenuSearch(event.target.value)} placeholder="Tìm tên món..." aria-label="Tìm món" /></div>
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Lọc danh mục">
          {([{ id: "all", label: "Tất cả" }, { id: "mains", label: "Mì chua cay" }, { id: "extras", label: "Ăn kèm" }, { id: "drinks", label: "Đồ uống" }] as const).map((category) =>
            <button type="button" key={category.id} onClick={() => setMenuCategory(category.id)} aria-pressed={menuCategory === category.id} className={`min-h-10 shrink-0 rounded-lg border px-3 text-sm font-semibold ${menuCategory === category.id ? "border-[#a82d1e] bg-[#a82d1e] text-white" : "border-[#e8d6c7] bg-white text-[#51392e]"}`}>{category.label}</button>)}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
      {filteredMenu.map((item) => {
        const quantity = cart[item.id] ?? 0;
        return <div key={item.id} data-selected={quantity > 0} className={`min-w-0 rounded-xl border p-3 transition-colors ${quantity ? "border-[#b03a27] bg-[#fff1e6] shadow-[inset_4px_0_0_#a82d1e]" : "border-[#edddce] bg-white"}`}>
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{item.name}</p>
              <p className="text-sm text-[#9e281c]">{formatMoney(item.price)}</p>
              {quantity > 0 && <p className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-[#a82d1e]"><Check aria-hidden="true" className="size-3.5" /> Đã chọn</p>}
            </div>
            <Button type="button" variant="outline" size="icon-sm" className="size-10 shrink-0 sm:size-9" disabled={saving || quantity <= 0} onClick={() => setCart((current) => ({ ...current, [item.id]: Math.max(0, (current[item.id] ?? 0) - 1) }))} aria-label={`Giảm ${item.name}`}>−</Button>
            <b className="w-5 text-center">{quantity}</b>
            <Button type="button" variant="outline" size="icon-sm" className="size-10 shrink-0 border-[#a82d1e] text-[#a82d1e] sm:size-9" disabled={saving || quantity >= 20} onClick={() => setCart((current) => ({ ...current, [item.id]: Math.min(20, (current[item.id] ?? 0) + 1) }))} aria-label={`Thêm ${item.name}`}>+</Button>
          </div>
          {quantity > 0 && <details className="mt-2 text-sm">
            <summary className="cursor-pointer font-semibold text-[#a82d1e]">Ghi chú riêng{(itemNotes[item.id]?.length || itemOtherNotes[item.id]) ? " · Đã chọn" : ""}</summary>
            <fieldset disabled={saving} className="mt-2 flex flex-wrap gap-2" aria-label={`Yêu cầu riêng cho ${item.name}`}>
              {quickNotes.map((note) => <label key={note} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border bg-white px-2 text-xs">
                <Checkbox checked={(itemNotes[item.id] ?? []).includes(note)} onCheckedChange={(checked) => setItemNotes((current) => ({ ...current, [item.id]: checked ? [...(current[item.id] ?? []), note] : (current[item.id] ?? []).filter((value) => value !== note) }))} />{note}
              </label>)}
            </fieldset>
            <Input className="mt-2 h-10" aria-label={`Ghi chú khác cho ${item.name}`} placeholder="Ghi chú khác cho món này..." maxLength={200} disabled={saving} value={itemOtherNotes[item.id] ?? ""} onChange={(event) => setItemOtherNotes((current) => ({ ...current, [item.id]: event.target.value }))} />
          </details>}
        </div>;
      })}
        </div>
        {!filteredMenu.length && <p className="rounded-xl border border-dashed bg-white p-5 text-center text-sm text-zinc-600">Không tìm thấy món phù hợp.</p>}
      </section>
      <section className="rounded-xl border border-[#edddce] bg-white p-3"><OrderNoteFields notes={notes} otherNote={otherNote} disabled={saving} setNotes={setNotes} setOtherNote={setOtherNote} /></section>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </div>
    <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[#eed9c8] bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-4">
      <div className="min-w-0"><p className="text-xs text-zinc-500">{itemCount} món · Tổng cộng</p><p className="text-lg font-black tabular-nums text-[#a82d1e] sm:text-2xl">{formatMoney(total)}</p></div>
      <Button className="h-11 shrink-0 rounded-lg bg-[#bd3b22] px-5 font-bold hover:bg-[#9e281c]" disabled={!selected.length || saving} onClick={() => void create()}>{saving ? <><LoaderCircle className="size-4 animate-spin" /> Đang tạo...</> : "Tạo đơn"}</Button>
    </div>
  </DialogContent>;
}
