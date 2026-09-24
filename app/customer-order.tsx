"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { Check, ChevronRight, Minus, Plus, ReceiptText, ShoppingBag, UtensilsCrossed } from "lucide-react";
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

const groups: Array<{ id: MenuItem["category"]; title: string }> = [
  { id: "mains", title: "Mì chua cay" },
  { id: "extras", title: "Ăn kèm" },
  { id: "drinks", title: "Đồ uống" },
];

const quickNotes = ["Ít cay", "Không hành", "Không giá"];
const maxQuantity = 20;

export function CustomerOrder({ initialTableCode = "" }: { initialTableCode?: string }) {
  const [tableCode, setTableCode] = useState(initialTableCode);
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

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeMobileCart = (event: MediaQueryListEvent) => {
      if (event.matches) setCartOpen(false);
    };

    desktop.addEventListener("change", closeMobileCart);
    return () => desktop.removeEventListener("change", closeMobileCart);
  }, []);

  function change(item: MenuItem, delta: number) {
    if (submitting) return;

    setCart((current) => {
      const quantity = Math.min(maxQuantity, (current[item.id]?.quantity ?? 0) + delta);
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
    if (!lines.length || submitting) return;

    const normalizedTableCode = tableCode.trim();
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tableCode: normalizedTableCode,
          orderType: normalizedTableCode ? "dine_in" : "takeaway",
          customerName,
          note: [...notes, otherNote].filter(Boolean).join(", "),
          items: lines.map((line) => ({ id: line.id, quantity: line.quantity, notes })),
        }),
      });
      const result = (await response.json().catch(() => null)) as {
        error?: string;
        order?: { code?: string; total?: number };
      } | null;

      if (!response.ok) throw new Error(result?.error ?? "Không thể gửi đơn");
      if (typeof result?.order?.code !== "string" || typeof result.order.total !== "number") {
        throw new Error("Phản hồi từ quán không hợp lệ. Vui lòng thử lại.");
      }

      setTableCode(normalizedTableCode);
      setSuccess({ code: result.order.code, total: result.order.total });
      setCart({});
      setNotes([]);
      setOtherNote("");
      setCartOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể gửi đơn");
    } finally {
      setSubmitting(false);
    }
  }

  const cartProps: CartFormProps = {
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
      <main className="grid min-h-screen place-items-center bg-brand-cream px-4 py-10 text-brand-ink">
        <section
          className="w-full max-w-sm rounded-3xl border border-brand-green/10 bg-white p-7 text-center shadow-sm"
          role="status"
          aria-live="polite"
        >
          <div className="mx-auto grid size-14 place-items-center rounded-full bg-brand-green-soft text-brand-green">
            <Check className="size-7" strokeWidth={2.5} />
          </div>
          <p className="mt-5 text-sm font-bold text-brand-green">Đã gửi tới bếp</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Đơn {success.code}</h1>
          <p className="mt-3 text-sm text-brand-muted">
            {tableCode ? `Bàn ${tableCode}` : "Mang về"} · {formatMoney(success.total)}
          </p>
          <p className="mt-6 border-t border-brand-green/10 pt-5 text-sm leading-6 text-brand-muted">
            Quán đã nhận được đơn. Bạn vui lòng chờ nhân viên chuẩn bị món.
          </p>
          <Button
            className="mt-6 h-12 w-full rounded-xl bg-brand-green text-base font-bold hover:bg-brand-green/90"
            onClick={() => setSuccess(null)}
          >
            Gọi thêm món
          </Button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-brand-cream text-brand-ink">
      <header className="border-b border-brand-green/10 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-4">
          <div className="grid size-10 place-items-center rounded-xl bg-brand-green text-lg font-extrabold text-white">M</div>
          <div className="ml-3">
            <p className="font-extrabold tracking-[0.12em] text-brand-green">MELI</p>
            <p className="text-xs text-brand-muted">Mì chua cay · Nghĩa Tân</p>
          </div>
          {tableCode.trim() && (
            <span className="ml-auto rounded-full bg-brand-green-soft px-3 py-1.5 text-sm font-bold text-brand-green">
              Bàn {tableCode.trim()}
            </span>
          )}
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 pb-28 pt-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:pb-12">
        <section>
          <div className="max-w-2xl">
            <p className="text-sm font-bold text-brand-orange">MENU HÔM NAY</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Bạn muốn ăn gì?</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-brand-muted sm:text-base">
              Chọn món và gửi đơn trực tiếp tới bếp. Giá đã bao gồm tại quán.
            </p>
          </div>

          <nav className="mt-6 flex gap-2 overflow-x-auto pb-1" aria-label="Danh mục món">
            {groups.map((group) => (
              <button
                key={group.id}
                type="button"
                className="min-h-11 shrink-0 rounded-xl border border-brand-green/15 bg-white px-4 text-sm font-semibold text-brand-green transition-colors hover:border-brand-green hover:bg-brand-green-soft"
                onClick={() => scrollToGroup(group.id)}
              >
                {group.title}
              </button>
            ))}
          </nav>

          <div className="mt-9 space-y-10">
            {groups.map((group) => {
              const items = menu.filter((item) => item.category === group.id);

              return (
                <section key={group.id} id={group.id} className="scroll-mt-4">
                  <div className="mb-4 flex items-baseline justify-between border-b border-brand-green/10 pb-3">
                    <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">{group.title}</h2>
                    <span className="text-sm text-brand-muted">{items.length} món</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {items.map((item) => {
                      const quantity = cart[item.id]?.quantity ?? 0;

                      return (
                        <article
                          key={item.id}
                          className="flex min-h-28 flex-col rounded-2xl border border-brand-green/10 bg-white p-4 transition-colors hover:border-brand-green/30"
                        >
                          <div>
                            <h3 className="font-bold leading-snug">{item.name}</h3>
                            <p className="mt-1 line-clamp-1 text-sm text-brand-muted">
                              {item.description || "Mát lạnh, giải khát"}
                            </p>
                          </div>
                          <div className="mt-auto flex items-end justify-between gap-3 pt-4">
                            <p className="font-bold text-brand-orange">{formatMoney(item.price)}</p>
                            {quantity > 0 ? (
                              <QuantityControl
                                item={item}
                                quantity={quantity}
                                disabled={submitting}
                                change={change}
                              />
                            ) : (
                              <Button
                                size="icon"
                                className="size-11 rounded-xl bg-brand-green hover:bg-brand-green/90"
                                disabled={submitting}
                                onClick={() => change(item, 1)}
                                aria-label={`Thêm ${item.name}`}
                              >
                                <Plus className="size-5" />
                              </Button>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </section>

        <aside className="hidden h-max rounded-2xl border border-brand-green/10 bg-white lg:sticky lg:top-6 lg:block">
          <CartForm {...cartProps} showHeader />
        </aside>
      </div>

      {itemCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-brand-green/10 bg-white px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 lg:hidden">
          <button
            type="button"
            className="mx-auto flex h-14 w-full max-w-lg items-center rounded-xl bg-brand-green px-4 text-left text-white"
            onClick={() => setCartOpen(true)}
          >
            <ShoppingBag className="mr-3 size-5" />
            <span className="min-w-0 flex-1">
              <span className="block text-xs text-white/70">{itemCount} món</span>
              <strong>{formatMoney(total)}</strong>
            </span>
            <span className="flex items-center text-sm font-bold">
              Xem giỏ <ChevronRight className="size-4" />
            </span>
          </button>
        </div>
      )}

      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent
          className="bottom-0 top-auto flex max-h-[92dvh] w-full max-w-none translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none rounded-t-2xl border-brand-green/10 bg-white p-0 text-brand-ink sm:max-w-none lg:hidden"
          overlayClassName="lg:hidden"
        >
          <DialogHeader className="shrink-0 border-b border-brand-green/10 p-5 pr-16 text-left">
            <DialogTitle className="text-xl font-extrabold">Đơn của bạn</DialogTitle>
            <DialogDescription>{itemCount} món · {formatMoney(total)}</DialogDescription>
          </DialogHeader>
          <CartForm {...cartProps} mobile />
        </DialogContent>
      </Dialog>
    </main>
  );
}

function QuantityControl({
  item,
  quantity,
  disabled,
  change,
}: {
  item: MenuItem;
  quantity: number;
  disabled: boolean;
  change: (item: MenuItem, delta: number) => void;
}) {
  return (
    <div className="flex items-center rounded-xl border border-brand-green/15 bg-white">
      <button
        type="button"
        className="grid size-11 place-items-center rounded-xl text-brand-green disabled:opacity-50"
        disabled={disabled}
        onClick={() => change(item, -1)}
        aria-label={`Giảm ${item.name}`}
      >
        <Minus className="size-4" />
      </button>
      <strong className="w-6 text-center text-sm">{quantity}</strong>
      <button
        type="button"
        className="grid size-11 place-items-center rounded-xl text-brand-green disabled:opacity-50"
        disabled={disabled || quantity >= maxQuantity}
        onClick={() => change(item, 1)}
        aria-label={`Thêm ${item.name}`}
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}

type CartFormProps = {
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
  setNotes: Dispatch<SetStateAction<string[]>>;
  setOtherNote: (value: string) => void;
  submit: () => void;
  mobile?: boolean;
  showHeader?: boolean;
};

function CartForm({
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
  mobile = false,
  showHeader = false,
}: CartFormProps) {
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit();
  }

  return (
    <form className={mobile ? "flex min-h-0 flex-1 flex-col" : ""} onSubmit={handleSubmit}>
      <div className={mobile ? "min-h-0 flex-1 overflow-y-auto px-5 py-4" : "p-5"}>
        {showHeader && (
          <div className="mb-4 flex items-center gap-2">
            <ReceiptText className="size-5 text-brand-green" />
            <h2 className="text-xl font-extrabold">Đơn của bạn</h2>
          </div>
        )}

        {!lines.length ? (
          <div className="rounded-xl border border-dashed border-brand-green/20 bg-brand-cream p-7 text-center text-sm text-brand-muted">
            <UtensilsCrossed className="mx-auto mb-3 size-6" />
            Chưa có món nào
          </div>
        ) : (
          <div className="divide-y divide-brand-green/10 border-y border-brand-green/10">
            {lines.map((line) => (
              <div key={line.id} className="flex items-center gap-2 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{line.name}</p>
                  <p className="mt-0.5 text-sm text-brand-orange">{formatMoney(line.price * line.quantity)}</p>
                </div>
                <QuantityControl item={line} quantity={line.quantity} disabled={submitting} change={change} />
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 space-y-4">
          <label className="block text-sm font-semibold">
            Số bàn
            <Input
              value={tableCode}
              onChange={(event) => setTableCode(event.target.value)}
              placeholder="Để trống nếu mang về"
              maxLength={20}
              disabled={submitting}
              className="mt-2 h-11 rounded-xl border-brand-green/15 bg-white"
            />
          </label>

          <label className="block text-sm font-semibold">
            Tên khách <span className="font-normal text-brand-muted">(không bắt buộc)</span>
            <Input
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              placeholder="Tên của bạn"
              maxLength={80}
              disabled={submitting}
              className="mt-2 h-11 rounded-xl border-brand-green/15 bg-white"
            />
          </label>

          <fieldset disabled={submitting}>
            <legend className="text-sm font-semibold">Yêu cầu cho món</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {quickNotes.map((note) => {
                const selected = notes.includes(note);

                return (
                  <label
                    key={note}
                    className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-medium ${
                      selected
                        ? "border-brand-green bg-brand-green-soft text-brand-green"
                        : "border-brand-green/15 bg-white"
                    }`}
                  >
                    <Checkbox
                      checked={selected}
                      onCheckedChange={(checked) =>
                        setNotes((current) =>
                          checked ? [...current, note] : current.filter((value) => value !== note),
                        )
                      }
                    />
                    {note}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <label className="block text-sm font-semibold">
            Ghi chú khác
            <Textarea
              value={otherNote}
              onChange={(event) => setOtherNote(event.target.value)}
              placeholder="Ví dụ: để nước dùng riêng..."
              maxLength={500}
              disabled={submitting}
              className="mt-2 min-h-20 rounded-xl border-brand-green/15 bg-white"
            />
          </label>

          {error && (
            <p className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>

      <div className={`border-t border-brand-green/10 bg-white p-5 ${mobile ? "shrink-0" : ""}`}>
        <div className="mb-4 flex items-center justify-between">
          <span className="font-semibold">Tổng cộng</span>
          <strong className="text-xl text-brand-orange">{formatMoney(total)}</strong>
        </div>
        <Button
          type="submit"
          className="h-12 w-full rounded-xl bg-brand-green text-base font-bold hover:bg-brand-green/90"
          disabled={!lines.length || submitting}
        >
          {submitting ? "Đang gửi đơn..." : "Gửi đơn tới bếp"}
        </Button>
      </div>
    </form>
  );
}
