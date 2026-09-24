export type MenuItem = { id: string; name: string; price: number; description: string; category: "mains" | "extras" | "drinks" };

export const formatMoney = (value: number) => `${value.toLocaleString("vi-VN")}₫`;
