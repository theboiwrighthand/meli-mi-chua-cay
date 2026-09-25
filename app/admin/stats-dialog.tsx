"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart3, RefreshCw } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatMoney } from "@/lib/menu";

type ItemShare = { name: string; value: number };
type Stats = {
  unpaidCount: number;
  paidCount: number;
  totalRevenue: number;
  revenueByItem: ItemShare[];
  quantityByItem: ItemShare[];
};

const colors = ["#a62f21", "#dd7a36", "#e9b655", "#648c79", "#6889a4", "#aa85a7", "#cbb8a7"];

function ShareChart({ title, description, data, total, formatValue, unit }: {
  title: string;
  description: string;
  data: ItemShare[];
  total: number;
  formatValue: (value: number) => string;
  unit: string;
}) {
  const top = data[0];
  const slices = data.length > 6
    ? [...data.slice(0, 6), { name: "Các món khác", value: data.slice(6).reduce((sum, item) => sum + item.value, 0) }]
    : data;

  return <section className="min-w-0 rounded-2xl border border-[#ead9c6] bg-white p-4 sm:p-5">
    <h3 className="text-base font-black text-[#3e261f] sm:text-lg">{title}</h3>
    <p className="mt-1 text-xs leading-relaxed text-[#756962]">{description}</p>
    {total === 0 ? <div className="grid min-h-56 place-items-center text-center text-sm text-[#756962]">Chưa có dữ liệu để vẽ biểu đồ.</div> : <>
      <div className="relative mx-auto mt-3 h-56 w-full max-w-[290px]" role="img" aria-label={`${title}: ${data.map((item) => `${item.name} ${formatValue(item.value)}`).join(", ")}`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={65} outerRadius={95} paddingAngle={2} stroke="none" isAnimationActive={false}>
              {slices.map((item, index) => <Cell key={item.name} fill={colors[index % colors.length]} />)}
            </Pie>
            <Tooltip formatter={(value) => formatValue(Number(value))} contentStyle={{ borderRadius: 12, borderColor: "#ead9c6", fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-[#756962]">Tổng</span>
          <strong className="text-base font-black text-[#3e261f] sm:text-lg">{formatValue(total)}</strong>
        </div>
      </div>
      <p className="mt-1 rounded-xl bg-[#fff3e4] px-3 py-2 text-xs text-[#6e4030]">
        Nhiều nhất: <strong>{top.name}</strong> · <strong>{((top.value / total) * 100).toFixed(1)}%</strong> ({formatValue(top.value)})
      </p>
      <ul className="mt-3 space-y-2" aria-label={`Chi tiết ${title.toLowerCase()}`}>
        {slices.map((item, index) => <li key={item.name} className="flex items-center gap-2 text-xs sm:text-sm">
          <span className="size-2.5 shrink-0 rounded-full" style={{ background: colors[index % colors.length] }} aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate" title={item.name}>{item.name}</span>
          <strong className="shrink-0 tabular-nums">{formatValue(item.value)}</strong>
          <span className="w-11 shrink-0 text-right tabular-nums text-[#756962]">{Math.round(item.value / total * 100)}%</span>
        </li>)}
      </ul>
      <p className="sr-only">Đơn vị: {unit}</p>
    </>}
  </section>;
}

export function StatsDialog({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchStats = useCallback(async () => {
    const response = await fetch("/api/admin/stats", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Không thể tải thống kê");
    return result as Stats;
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchStats().then((result) => { if (!cancelled) setStats(result); })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Không thể tải thống kê"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fetchStats]);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      setStats(await fetchStats());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tải thống kê");
    } finally {
      setLoading(false);
    }
  }

  const quantityTotal = stats?.quantityByItem.reduce((sum, item) => sum + item.value, 0) ?? 0;

  return <Dialog open onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[92dvh] w-[calc(100%-1rem)] overflow-y-auto bg-[#fffaf2] p-4 sm:max-w-5xl sm:p-6">
      <DialogHeader className="pr-10 text-left">
        <DialogTitle className="flex items-center gap-2 text-xl font-black"><BarChart3 className="size-5 text-[#a62f21]" /> Thống kê đơn hàng</DialogTitle>
        <DialogDescription>Tất cả đơn đang lưu · Doanh thu chỉ tính đơn đã thanh toán.</DialogDescription>
      </DialogHeader>
      <div className="flex justify-end">
        <Button variant="outline" size="sm" disabled={loading} onClick={() => void refresh()} className="rounded-lg"><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Làm mới</Button>
      </div>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {loading && !stats ? <p role="status" className="py-16 text-center text-sm text-[#756962]">Đang tải thống kê…</p> : stats && <>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
          <div className="rounded-xl border border-[#ead9c6] bg-white p-3"><p className="text-xs text-[#756962]">Chưa thanh toán</p><strong className="mt-1 block text-xl font-black tabular-nums">{stats.unpaidCount} đơn</strong></div>
          <div className="rounded-xl border border-[#ead9c6] bg-white p-3"><p className="text-xs text-[#756962]">Đã thanh toán</p><strong className="mt-1 block text-xl font-black tabular-nums">{stats.paidCount} đơn</strong></div>
          <div className="col-span-2 rounded-xl border border-[#ead9c6] bg-white p-3 sm:col-span-1"><p className="text-xs text-[#756962]">Tổng doanh thu</p><strong className="mt-1 block text-xl font-black tabular-nums text-[#a62f21]">{formatMoney(stats.totalRevenue)}</strong></div>
        </div>
        <div className="grid min-w-0 gap-3 lg:grid-cols-2">
          <ShareChart title="Doanh thu theo món" description="Tỷ trọng giá trị từng món trong các đơn đã thanh toán." data={stats.revenueByItem} total={stats.totalRevenue} formatValue={formatMoney} unit="đồng" />
          <ShareChart title="Món được gọi nhiều nhất" description="Tổng số phần đã gọi trong các đơn chưa bị hủy, kể cả đơn chưa thanh toán." data={stats.quantityByItem} total={quantityTotal} formatValue={(value) => `${value} phần`} unit="phần" />
        </div>
      </>}
    </DialogContent>
  </Dialog>;
}
