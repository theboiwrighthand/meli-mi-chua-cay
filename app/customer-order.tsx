"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { Check, ChevronRight, Coffee, LayoutDashboard, MapPin, Minus, Plus, ReceiptText, ShoppingCart, UtensilsCrossed, Soup, Truck, CookingPot } from "lucide-react";
import Image from "next/image";
import { NavigationIconLink } from "@/components/navigation-icon-link";
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
import { formatMoney, type MenuItem } from "@/lib/menu";

type CartLine = MenuItem & { quantity: number; notes: string[]; otherNote: string };

const groups: Array<{ id: MenuItem["category"]; title: string }> = [
  { id: "mains", title: "Mì chua cay" },
  { id: "extras", title: "Ăn kèm" },
  { id: "drinks", title: "Đồ uống" },
];

const quickNotes = ["Không hành", "Không giá đỗ", "Không rau", "Giảm cay"];
const maxQuantity = 20;

// Only attach a photo when it really depicts the product; the rest use a category illustration.
const itemPhotos: Record<string, string> = {
  "mi-tim-cat": "https://down-bs-vn.img.susercontent.com/vn-11134517-7r98o-lqz49vpvbnvd94",
  "mi-bo-moc": "https://down-bs-vn.img.susercontent.com/vn-11134517-7r98o-lqz49uh751ac33",
  "mi-tim-cat-moc": "https://down-bs-vn.img.susercontent.com/vn-11134517-7r98o-lqz49waehm6xb9",
  "mi-bo-tim-cat": "https://down-bs-vn.img.susercontent.com/vn-11134517-7r98o-lqz49v487c0p5b",
  "mi-dac-biet": "https://down-bs-vn.img.susercontent.com/vn-11134517-7r98o-lqz49qc772qh6b",
  quay: "https://down-bs-vn.img.susercontent.com/vn-11134517-7r98o-lqz49rixgjo9c1",
  "mi-them": "https://down-bs-vn.img.susercontent.com/vn-11134517-7r98o-lr3qpgn4ztlle4",
  "trung-non": "https://down-bs-vn.img.susercontent.com/vn-11134517-81ztc-mps2tr0uwmipa9",
};

function MenuItemPicture({ item }: { item: MenuItem }) {
  const [failed, setFailed] = useState(false);
  const src = itemPhotos[item.id];
  return (
    <div className={`meli-food-image meli-food-image-${item.category}`}>
      {src && !failed ? (
        <Image src={src} alt={`Ảnh minh họa ${item.name}`} fill unoptimized sizes="(max-width: 640px) 45vw, (max-width: 1280px) 30vw, 220px" className="object-cover" onError={() => setFailed(true)} />
      ) : (
        <div className="meli-food-placeholder" style={{ display: "flex", width: "100%", height: "100%", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }} role="img" aria-label={`Hình đại diện nhóm ${item.category === "mains" ? "mì chua cay" : item.category === "extras" ? "ăn kèm" : "đồ uống"}`}>
          {item.category === "mains" ? <Soup aria-hidden="true" /> : item.category === "extras" ? <CookingPot aria-hidden="true" /> : <Coffee aria-hidden="true" />}
          {/* <span>{item.category === "mains" ? "Mì chua cay" : item.category === "extras" ? "Ăn kèm" : "Đồ uống"}</span> */}
        </div>
      )}
    </div>
  );
}

export function CustomerOrder({ initialTableCode = "", menu, isAdmin = false }: { initialTableCode?: string; menu: MenuItem[]; isAdmin?: boolean }) {
  const [tableCode, setTableCode] = useState(initialTableCode);
  const [isTakeaway, setIsTakeaway] = useState(false);
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [notes, setNotes] = useState<string[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [otherNote, setOtherNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");
  const [success, setSuccess] = useState<{ code: string; total: number; tableCode: string; isTakeaway: boolean } | null>(null);
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
      else next[item.id] = { ...item, quantity, notes: current[item.id]?.notes ?? [], otherNote: current[item.id]?.otherNote ?? "" };

      return next;
    });
  }

  function updateLine(id: string, patch: Partial<Pick<CartLine, "notes" | "otherNote">>) {
    setCart((current) => current[id] ? { ...current, [id]: { ...current[id], ...patch } } : current);
  }

  function scrollToGroup(id: string) {
    setActiveCategory(id === "menu-list" ? "all" : id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function submit() {
    if (!lines.length || submitting) return;

    const normalizedTableCode = isTakeaway ? "" : tableCode.trim();
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tableCode: normalizedTableCode,
          orderType: isTakeaway ? "takeaway" : "dine_in",
          customerName,
          note: [...notes, otherNote].filter(Boolean).join(", "),
          items: lines.map((line) => ({ id: line.id, quantity: line.quantity, notes: [...line.notes, line.otherNote.trim()].filter(Boolean) })),
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
      setSuccess({ code: result.order.code, total: result.order.total, tableCode: normalizedTableCode, isTakeaway });
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
    isTakeaway,
    customerName,
    notes,
    otherNote,
    error,
    submitting,
    change,
    updateLine,
    clearCart: () => setCart({}),
    setTableCode,
    setIsTakeaway: (next: boolean) => {
      setIsTakeaway(next);
      if (next) setTableCode("");
    },
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
            {success.isTakeaway ? "Mang về" : success.tableCode ? `Bàn ${success.tableCode}` : "Dùng tại chỗ"} · {formatMoney(success.total)}
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
    <main className="meli-storefront min-h-screen bg-brand-cream text-brand-ink">

        <div className="meli-store-topbar">
          <div className="meli-store-topbar-inner">
            <div className="meli-brand"><div><strong>MELI</strong><small>MÌ CHUA CAY</small></div></div>
            <span className="meli-store-address"><MapPin className="size-4 shrink-0" aria-hidden="true" />106-C4 Nghĩa Tân · Cầu Giấy</span>
            <div className="meli-hero-actions">
              {tableCode.trim() && !isTakeaway && <span className="meli-table-badge">Bàn {tableCode.trim()}</span>}
              {isAdmin && <NavigationIconLink href="/admin" className="meli-admin-link" label="Mở trang quản lý đơn"><LayoutDashboard className="size-5" /></NavigationIconLink>}
            </div>
          </div>
        </div>
      <header className="meli-hero">
        <div className="meli-hero-banner">
          <div className="meli-hero-photo" aria-hidden="true"><Image src="/noodle-hero.webp" alt="" fill priority sizes="(max-width: 640px) 60vw, 520px" className="object-cover" /></div>
          <div className="meli-hero-inner"><div className="meli-hero-copy"><h1>Mì chua cay, đúng vị bạn thích.</h1><p>Chọn món ngon, quán làm ngay.</p></div></div>
        </div>
      </header>

      <div className="meli-layout mx-auto grid max-w-[1320px] gap-6 px-4 pb-28 pt-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:pb-12">
        <section>
          <nav className="meli-tabs" aria-label="Danh mục món">
            <button type="button" onClick={() => scrollToGroup("menu-list")} className={`meli-tab ${activeCategory === "all" ? "meli-tab-active" : ""}`}>Tất cả</button>
            {groups.map((group) => (
              <button key={group.id} type="button" className={`meli-tab ${activeCategory === group.id ? "meli-tab-active" : ""}`} onClick={() => scrollToGroup(group.id)}>
                {group.title}
              </button>
            ))}
          </nav>
          <p className="meli-menu-note">Thực đơn hôm nay <span>· Ảnh món chỉ mang tính minh họa</span></p>

          <div id="menu-list" className="space-y-10">
            {groups.map((group) => {
              const items = menu.filter((item) => item.category === group.id);

              return (
                <section key={group.id} id={group.id} className="scroll-mt-6">
                  <div className="meli-section-heading mb-4 flex items-baseline justify-between pb-3">
                    <h2 className="flex items-center gap-2 text-xl font-extrabold tracking-tight sm:text-2xl">
                      {group.id === "mains" ? <Soup aria-hidden="true" className="size-6 text-brand-orange" /> : group.id === "extras" ? <CookingPot aria-hidden="true" className="size-6 text-brand-orange" /> : <Coffee aria-hidden="true" className="size-6 text-brand-orange" />}
                      {group.title}
                    </h2>
                    <span className="text-sm text-brand-muted">{items.length} món</span>
                  </div>
                  <div className="meli-item-grid grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {items.map((item) => {
                      const quantity = cart[item.id]?.quantity ?? 0;

                      return (
                        <article key={item.id} className="meli-food-card">
                          <MenuItemPicture item={item} />
                          <div className="meli-food-content">
                            <h3>{item.name}</h3>
                            <p>{item.description || (item.category === "drinks" ? "Giải khát" : "Món ngon tại MELI")}</p>
                            <div className="meli-food-bottom">
                              <strong>{formatMoney(item.price)}</strong>
                              {quantity > 0 ? (
                                <QuantityControl item={item} quantity={quantity} disabled={submitting} change={change} />
                              ) : (
                                <Button size="icon" className="meli-add-button" disabled={submitting} onClick={() => change(item, 1)} aria-label={`Thêm ${item.name}`}>
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
          </div>
        </section>

        <aside className="meli-cart hidden h-max lg:sticky lg:top-6 lg:block">
          <CartForm {...cartProps} showHeader />
        </aside>
      </div>

      {itemCount > 0 && (
        <div className="meli-mobile-cart-bar fixed inset-x-0 bottom-0 z-40 border-t border-brand-green/10 bg-[#fff9f0] px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 lg:hidden">
          <button
            type="button"
            className="mx-auto flex h-14 w-full max-w-lg items-center rounded-xl bg-brand-green px-4 text-left text-white shadow-lg"
            onClick={() => setCartOpen(true)}
          >
            <ShoppingCart className="mr-3 size-5" />
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
          className="meli-mobile-sheet flex max-h-[92dvh] min-w-0 flex-col gap-0 overflow-hidden rounded-b-none rounded-t-2xl border-brand-green/10 bg-[#fffaf2] p-0 text-brand-ink max-lg:translate-x-0 max-lg:translate-y-0 lg:hidden"
          overlayClassName="lg:hidden"
        >
          <DialogHeader className="shrink-0 border-b border-brand-green/10 px-4 pb-3 pt-5 pr-16 text-left sm:px-5">
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
    <div className="meli-quantity flex items-center rounded-lg border border-brand-green/15 bg-white">
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
  isTakeaway: boolean;
  customerName: string;
  notes: string[];
  otherNote: string;
  error: string;
  submitting: boolean;
  change: (item: MenuItem, delta: number) => void;
  updateLine: (id: string, patch: Partial<Pick<CartLine, "notes" | "otherNote">>) => void;
  clearCart: () => void;
  setTableCode: (value: string) => void;
  setIsTakeaway: (value: boolean) => void;
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
  isTakeaway,
  customerName,
  notes,
  otherNote,
  error,
  submitting,
  change,
  updateLine,
  clearCart,
  setTableCode,
  setIsTakeaway,
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
    <form className={mobile ? "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden" : ""} onSubmit={handleSubmit}>
      <div className={mobile ? "min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-3 sm:px-5" : "p-5"}>
        {showHeader && (
          <div className="mb-4 flex items-center gap-2">
            <ReceiptText className="size-5 text-brand-green" />
            <h2 className="flex-1 text-xl font-extrabold">Đơn của bạn</h2>
            {lines.length > 0 && <button type="button" disabled={submitting} onClick={clearCart} className="text-xs font-semibold text-[#a82d1e] hover:underline">Xóa tất cả</button>}
          </div>
        )}

        {mobile && lines.length > 0 && <div className="mb-2 flex justify-end"><button type="button" disabled={submitting} onClick={clearCart} className="text-xs font-semibold text-[#a82d1e] hover:underline">Xóa tất cả</button></div>}

        {!lines.length ? (
          <div className="rounded-xl border border-dashed border-brand-green/20 bg-brand-cream p-7 text-center text-sm text-brand-muted">
            <UtensilsCrossed className="mx-auto mb-3 size-6" />
            Chưa có món nào
          </div>
        ) : (
          <div className="divide-y divide-brand-green/10 border-y border-brand-green/10">
            {lines.map((line) => (
              <div key={line.id} className="py-3">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{line.name}</p>
                    <p className="mt-0.5 text-sm text-brand-orange">{formatMoney(line.price * line.quantity)}</p>
                  </div>
                  <QuantityControl item={line} quantity={line.quantity} disabled={submitting} change={change} />
                </div>
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer font-semibold text-brand-green">Ghi chú riêng cho {line.name}{line.notes.length || line.otherNote ? " · Đã chọn" : ""}</summary>
                  <fieldset disabled={submitting} className="mt-2 flex flex-wrap gap-2" aria-label={`Yêu cầu riêng cho ${line.name}`}>
                    {quickNotes.map((note) => <label key={note} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-brand-green/15 bg-white px-2 text-xs">
                      <Checkbox checked={line.notes.includes(note)} onCheckedChange={(checked) => updateLine(line.id, { notes: checked ? [...line.notes, note] : line.notes.filter((value) => value !== note) })} />{note}
                    </label>)}
                  </fieldset>
                  <Input className="mt-2 h-10 bg-white" aria-label={`Ghi chú khác cho ${line.name}`} placeholder="Ghi chú khác cho món này..." maxLength={200} disabled={submitting} value={line.otherNote} onChange={(event) => updateLine(line.id, { otherNote: event.target.value })} />
                </details>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold">Số bàn</label>
            <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-3">
              <Input
                value={tableCode}
                onChange={(event) => setTableCode(event.target.value)}
                placeholder={isTakeaway ? "Không áp dụng khi mang về" : "Có thể để trống"}
                maxLength={20}
                disabled={submitting || isTakeaway}
                className="h-11 min-w-0 rounded-xl border-brand-green/15 bg-white"
              />
              <label className="flex h-11 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl border border-brand-green/15 bg-white px-3 text-sm font-semibold">
                <Checkbox checked={isTakeaway} disabled={submitting} onCheckedChange={(checked) => setIsTakeaway(checked === true)} />
                <Truck aria-hidden="true" className="size-5 shrink-0 text-[#13978b]" />
                <span>Mang về</span>
              </label>
            </div>
          </div>

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
            <legend className="text-sm font-semibold">Yêu cầu chung cho đơn</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {quickNotes.map((note) => {
                const selected = notes.includes(note);

                return (
                  <label
                    key={note}
                    className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-xs font-medium ${
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

      <div className={`border-t border-brand-green/10 bg-white p-4 sm:p-5 ${mobile ? "shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]" : ""}`}>
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
