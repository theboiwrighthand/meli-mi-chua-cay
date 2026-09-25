import type { Metadata, Viewport } from "next";
import "./iphone.css";

export const metadata: Metadata = {
  title: "MELI · Quản lý đơn",
  description: "Theo dõi và xử lý đơn hàng Mì Chua Cay Meli.",
  manifest: "/admin-manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "MELI Quản lý",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/admin-icon-192.png",
    apple: [{ url: "/admin-apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
