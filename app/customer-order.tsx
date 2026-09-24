"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Check,
  ChevronRight,
  Cookie,
  CupSoda,
  Minus,
  Plus,
  ReceiptText,
  ShoppingBag,
  Soup,
  Store,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney, menu, type MenuItem } from "@/lib/menu";

type CartLine = MenuItem & { quantity: number };

const groups: Array<{
  id: MenuItem["category"];
  title: string;
  subtitle: string;
  icon: LucideIcon;
}> = [
  { id: "mains", title: "Mì chua cay", subtitle: "Nóng hổi, đậm vị", icon: Soup },
  { id: "extras", title: "Ăn kèm", subtitle: "Thêm món, thêm vui", icon: Cookie },
  { id: "drinks", title: "Đồ uống", subtitle: "Mát lạnh giải cay", icon: CupSoda },
];

const quickNotes = ["Ít cay", "Không hành", "Không giá"];

export function CustomerOrder() {
  const [tableCode, setTableCode] = useState(() =>
    typeof window === "undefined"
      ? ""
      : new URLSearchParams(window.location.search).get("table") ?? "",
  );
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [notes, setNotes] = useState<string[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [otherNote, setOtherNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [success, setSuccess] = useState<{ code: string; total: number } | null>(null);
  const [error, setError] = useState("");

  const lines = Object.values(cart);
  const total = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);

  function change(item: MenuItem, delta: number) {
    setCart((current) => {
      const quantity = (current[item.id]?.quantity ?? 0) + delta;
      const next = { ...current };

      if (quantity <= 0) delete next[item.id];
      else next[item.id] = { ...item, quantity };

      return next;
    });
  }

  function scrollToGroup(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function submit() {
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tableCode,
          orderType: tableCode ? "dine_in" : "takeaway",
          customerName,
          note: [...notes, otherNote].filter(Boolean).join(", "),
          items: lines.map((line) => ({ id: line.id, quantity: line.quantity, notes })),
        }),
      });
      const result = await response.json();

      if (!response.ok) throw new Error(result.error ?? "Không thể gửi đơn");

      setSuccess({ code: result.order.code, total: result.order.total });
      setCart({});
      setCartOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể gửi đơn");
    } finally {
      setSubmitting(false);
    }
  }

  const cartProps = {
    lines,
    total,
    tableCode,
    customerName,
    notes,
    otherNote,
    error,
    submitting,
    change,
    setTableCode,
    setCustomerName,
    setNotes,
    setOtherNote,
    submit,
  };

  if (success) {
    return (
      <main className="grid min-h-screen place-items-center bg-brand-cream px-4 py-12 text-brand-ink">
        <section className="w-full max-w-md overflow-hidden rounded-[2rem] border border-brand-green/10 bg-white shadow-[0_24px_80px_rgba(17,61,40,0.14)]">
          <div className="bg-brand-green px-8 py-9 text-center text-white">
            <div className="mx-auto mb-5 grid size-16 place-items-center rounded-full bg-white text-brand-green shadow-lg">
              <Check className="size-8" strokeWidth={3} />
            </div>
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-brand-peach">
              Đã gửi tới quán
            </p>
            <h1 className="mt-2 text-4xl font-black tracking-tight">Đơn {success.code}</h1>
          </div>
          <div className="p-7 text-center">
            <p className="text-sm font-semibold text-brand-muted">
              {tableCode ? `Bàn ${tableCode}` : "Mang về"}
            </p>
            <p className="mt-1 text-2xl font-black text-brand-orange">
              {formatMoney(success.total)}
            </p>
            <p className="mt-5 rounded-2xl bg-brand-cream p-4 text-sm leading-6">
              Bếp đã nhận được đơn. Bạn vui lòng chờ trong ít phút nhé.
            </p>
            <Button
              className="mt-6 h-12 w-full rounded-2xl bg-brand-green text-base font-extrabold hover:bg-brand-green/90"
              onClick={() => setSuccess(null)}
            >
              Gọi thêm món
            </Button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-brand-cream text-brand-ink">
      <header className="sticky top-0 z-30 border-b border-brand-green/10 bg-brand-cream/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[68px] max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-[15px] bg-brand-orange text-xl font-black text-white shadow-[0_7px_18px_rgba(232,92,28,0.24)]">
              M
            </div>
            <div>
              <div className="font-black tracking-[0.16em] text-brand-green">MELI</div>
              <div className="text-[11px] font-semibold text-brand-muted">Mì chua cay · Nghĩa Tân</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {tableCode && (
              <span className="rounded-full bg-brand-green-soft px-3 py-2 text-sm font-extrabold text-brand-green">
                Bàn {tableCode}
              </span>
            )}
            <Button asChild variant="outline" size="icon" className="size-11 rounded-2xl border-brand-green/15 bg-white">
              <Link href="/admin" aria-label="Mở trang quản lý">
                <Store className="size-5" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <nav className="sticky top-[68px] z-20 border-b border-brand-green/10 bg-brand-cream/95 backdrop-blur-xl lg:hidden" aria-label="Danh mục món">
        <div className="scrollbar-none mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-2.5">
          {groups.map((group) => (
            <button
              key={group.id}
              type="button"
              className="shrink-0 rounded-full border border-brand-green/10 bg-white px-4 py-2 text-sm font-extrabold text-brand-green shadow-sm transition-colors active:bg-brand-green active:text-white"
              onClick={() => scrollToGroup(group.id)}
            >
              {group.title}
            </button>
          ))}
        </div>
      </nav>

      <div className="mx-auto grid max-w-6xl gap-7 px-4 pb-32 pt-5 lg:grid-cols-[minmax(0,1fr)_370px] lg:pb-10 lg:pt-7">
        <section>
          <div className="relative mb-8 min-h-[260px] overflow-hidden rounded-[2rem] bg-brand-green text-white sm:min-h-[290px]">
            <Image
              src="/menu.jpeg"
              alt="Bảng menu tại quán MELI"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 760px"
              className="object-cover object-[50%_27%] opacity-55 sm:object-[50%_29%]"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-brand-green via-brand-green/90 to-brand-green/20" />
            <div className="relative flex min-h-[260px] max-w-lg flex-col justify-end p-6 sm:min-h-[290px] sm:p-9">
              <span className="mb-auto w-fit rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.14em] text-brand-peach backdrop-blur-sm">
                Nóng hổi · Đậm vị
              </span>
              <h1 className="text-4xl font-black leading-[0.95] tracking-[-0.04em] sm:text-6xl">
                Một tô ngon,
                <br />đúng gu bạn.
              </h1>
              <p className="mt-4 max-w-sm text-sm font-medium leading-6 text-white/80 sm:text-base">
                Chọn món, thêm ghi chú và gửi thẳng tới bếp ngay tại bàn.
              </p>
            </div>
          </div>

          {groups.map((group, groupIndex) => {
            const GroupIcon = group.icon;
            const items = menu.filter((item) => item.category === group.id);

            return (
              <section key={group.id} id={group.id} className="mb-10 scroll-mt-32 lg:scroll-mt-24">
                <div className="mb-4 flex items-end justify-between">
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-orange">
                      {group.subtitle}
                    </p>
                    <h2 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">{group.title}</h2>
                  </div>
                  <span className="text-sm font-semibold text-brand-muted">{items.length} món</span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {items.map((item, itemIndex) => {
                    const quantity = cart[item.id]?.quantity ?? 0;
                    const featured = groupIndex === 0 && (itemIndex === 0 || itemIndex === items.length - 1);

                    return (
                      <article
                        key={item.id}
                        className="group flex min-h-[132px] items-stretch overflow-hidden rounded-[1.4rem] border border-brand-green/10 bg-white shadow-[0_8px_28px_rgba(17,61,40,0.055)] transition-transform sm:hover:-translate-y-0.5"
                      >
                        <div className="relative grid w-[94px] shrink-0 place-items-center overflow-hidden bg-brand-peach/55 text-brand-orange">
                          <div className="absolute -left-7 -top-7 size-20 rounded-full border border-brand-orange/15" />
                          <div className="absolute -bottom-8 -right-8 size-24 rounded-full bg-brand-orange/10" />
                          <GroupIcon className="relative size-9" strokeWidth={1.8} />
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              {featured && (
                                <span className="mb-1 inline-block text-[10px] font-black uppercase tracking-[0.12em] text-brand-orange">
                                  {item.id === "mi-dac-biet" ? "Đặc biệt" : "Được yêu thích"}
                                </span>
                              )}
                              <h3 className="font-extrabold leading-tight">{item.name}</h3>
                            </div>
                          </div>
                          <p className="mt-1 line-clamp-1 text-xs font-medium text-brand-muted">
                            {item.description || "Mát lạnh, giải khát"}
                          </p>
                          <div className="mt-auto flex items-end justify-between gap-3 pt-3">
                            <p className="font-black text-brand-orange">{formatMoney(item.price)}</p>
                            {quantity > 0 ? (
                              <div className="flex items-center gap-1 rounded-full bg-brand-green text-white shadow-sm">
                                <button
                                  type="button"
                                  className="grid size-10 place-items-center rounded-full transition-colors hover:bg-white/10"
                                  onClick={() => change(item, -1)}
                                  aria-label={`Giảm ${item.name}`}
                                >
                                  <Minus className="size-4" />
                                </button>
                                <strong className="w-5 text-center text-sm" aria-live="polite">
                                  {quantity}
                                </strong>
                                <button
                                  type="button"
                                  className="grid size-10 place-items-center rounded-full transition-colors hover:bg-white/10"
                                  onClick={() => change(item, 1)}
                                  aria-label={`Thêm ${item.name}`}
                                >
                                  <Plus className="size-4" />
                                </button>
                              </div>
                            ) : (
                              <Button
                                size="icon"
                                className="size-11 rounded-full bg-brand-green shadow-md hover:bg-brand-green/90"
                                onClick={() => change(item, 1)}
                                aria-label={`Thêm ${item.name}`}
                              >
                                <Plus className="size-5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </section>

        <aside className="hidden h-max rounded-[1.75rem] border border-brand-green/10 bg-white p-5 shadow-[0_18px_60px_rgba(17,61,40,0.1)] lg:sticky lg:top-24 lg:block">
          <CartContent {...cartProps} />
        </aside>
      </div>

      {itemCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-brand-green/10 bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_40px_rgba(17,61,40,0.12)] backdrop-blur-xl lg:hidden">
          <button
            type="button"
            className="mx-auto flex h-14 w-full max-w-lg items-center gap-3 rounded-2xl bg-brand-green px-4 text-left text-white shadow-lg shadow-brand-green/20"
            onClick={() => setCartOpen(true)}
          >
            <span className="grid size-9 place-items-center rounded-xl bg-white/15">
              <ShoppingBag className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-white/70">{itemCount} món đã chọn</span>
              <strong className="block text-base">{formatMoney(total)}</strong>
            </span>
            <span className="flex items-center text-sm font-extrabold">
              Xem giỏ <ChevronRight className="size-4" />
            </span>
          </button>
        </div>
      )}

      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent className="bottom-0 top-auto max-h-[92dvh] max-w-none translate-y-0 gap-0 overflow-y-auto rounded-b-none rounded-t-[2rem] border-brand-green/10 p-0 lg:hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Đơn của bạn</DialogTitle>
            <DialogDescription>Kiểm tra món đã chọn và gửi đơn tới quán.</DialogDescription>
          </DialogHeader>
          <div className="mx-auto mt-2.5 h-1.5 w-12 rounded-full bg-brand-green/15" />
          <div className="p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
            <CartContent {...cartProps} />
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}

type CartContentProps = {
  lines: CartLine[];
  total: number;
  tableCode: string;
  customerName: string;
  notes: string[];
  otherNote: string;
  error: string;
  submitting: boolean;
  change: (item: MenuItem, delta: number) => void;
  setTableCode: (value: string) => void;
  setCustomerName: (value: string) => void;
  setNotes: (value: string[] | ((current: string[]) => string[])) => void;
  setOtherNote: (value: string) => void;
  submit: () => void;
};

function CartContent({
  lines,
  total,
  tableCode,
  customerName,
  notes,
  otherNote,
  error,
  submitting,
  change,
  setTableCode,
  setCustomerName,
  setNotes,
  setOtherNote,
  submit,
}: CartContentProps) {
  return (
    <div>
      <div className="flex items-center gap-2.5">
        <span className="grid size-10 place-items-center rounded-2xl bg-brand-green-soft text-brand-green">
          <ReceiptText className="size-5" />
        </span>
        <div>
          <h2 className="text-xl font-black tracking-tight">Đơn của bạn</h2>
          <p className="text-xs font-medium text-brand-muted">Kiểm tra trước khi gửi tới bếp</p>
        </div>
      </div>

      {!lines.length ? (
        <div className="my-5 rounded-2xl border border-dashed border-brand-green/20 bg-brand-cream/60 p-8 text-center text-sm font-semibold text-brand-muted">
          <UtensilsCrossed className="mx-auto mb-3 size-7 text-brand-green/50" />
          Chưa có món nào
        </div>
      ) : (
        <div className="my-4 divide-y divide-brand-green/10">
          {lines.map((line) => (
            <div key={line.id} className="flex items-center gap-2 py-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-extrabold">{line.name}</div>
                <div className="mt-0.5 text-sm font-bold text-brand-orange">
                  {formatMoney(line.price * line.quantity)}
                </div>
              </div>
              <Button
                variant="outline"
                size="icon"
                className="size-11 rounded-full border-brand-green/15"
                onClick={() => change(line, -1)}
                aria-label={`Giảm ${line.name}`}
              >
                <Minus />
              </Button>
              <strong className="w-6 text-center" aria-live="polite">
                {line.quantity}
              </strong>
              <Button
                variant="outline"
                size="icon"
                className="size-11 rounded-full border-brand-green/15"
                onClick={() => change(line, 1)}
                aria-label={`Thêm ${line.name}`}
              >
                <Plus />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-between border-t border-brand-green/10 pt-4 text-xl font-black" aria-live="polite">
        <span>Tổng cộng</span>
        <span className="text-brand-orange">{formatMoney(total)}</span>
      </div>

      <div className="mt-5 space-y-4">
        <label className="block text-sm font-extrabold">
          Số bàn
          <Input
            value={tableCode}
            onChange={(event) => setTableCode(event.target.value)}
            placeholder="Ví dụ: 05"
            className="mt-2 h-11 rounded-xl border-brand-green/15 bg-brand-cream/35"
          />
          <span className="mt-1.5 block text-xs font-medium text-brand-muted">Để trống nếu bạn đặt mang về.</span>
        </label>

        <label className="block text-sm font-extrabold">
          Tên khách <span className="font-medium text-brand-muted">(không bắt buộc)</span>
          <Input
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
            placeholder="Tên của bạn"
            className="mt-2 h-11 rounded-xl border-brand-green/15 bg-brand-cream/35"
          />
        </label>

        <fieldset>
          <legend className="text-sm font-extrabold">Yêu cầu cho món</legend>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {quickNotes.map((note) => {
              const selected = notes.includes(note);

              return (
                <label
                  key={note}
                  className={`flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-2 text-center text-xs font-extrabold transition-colors ${
                    selected
                      ? "border-brand-green bg-brand-green-soft text-brand-green"
                      : "border-brand-green/10 bg-white"
                  }`}
                >
                  <Checkbox
                    checked={selected}
                    onCheckedChange={(checked) =>
                      setNotes((current) =>
                        checked ? [...current, note] : current.filter((value) => value !== note),
                      )
                    }
                    aria-label={note}
                  />
                  {note}
                </label>
              );
            })}
          </div>
        </fieldset>

        <label className="block text-sm font-extrabold">
          Ghi chú khác
          <Textarea
            value={otherNote}
            onChange={(event) => setOtherNote(event.target.value)}
            placeholder="Ví dụ: để nước dùng riêng..."
            className="mt-2 min-h-20 rounded-xl border-brand-green/15 bg-brand-cream/35"
          />
        </label>

        {error && (
          <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700" role="alert">
            {error}
          </p>
        )}

        <Button
          className="h-12 w-full rounded-2xl bg-brand-orange text-base font-extrabold shadow-lg shadow-brand-orange/20 hover:bg-brand-orange/90"
          disabled={!lines.length || submitting}
          onClick={submit}
        >
          {submitting ? "Đang gửi đơn..." : "Gửi đơn tới bếp"}
        </Button>
      </div>
    </div>
  );
}
