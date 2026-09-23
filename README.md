# MELI — Mì chua cay

Ứng dụng đặt món tại quán và quản lý đơn, chạy bằng Next.js App Router, PostgreSQL/Supabase, Drizzle ORM và Supabase Auth. Giao diện khách hàng và màn hình quản lý được giữ từ phiên bản đầu.

## Chạy local

1. Tạo project Supabase và sao chép `.env.example` thành `.env.local`.
2. Điền `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` và `ADMIN_EMAIL`.
3. Chạy `pnpm install`, `pnpm db:migrate`, rồi `pnpm dev`.
4. Trong Supabase Auth, tạo tài khoản có email trùng `ADMIN_EMAIL` để truy cập `/admin`.

## Deploy Vercel + GitHub

Đẩy repository lên GitHub, import repository trong Vercel và khai báo bốn biến môi trường như `.env.example`. Build command là `pnpm build`; Vercel tự nhận diện Next.js. Chạy migration bằng `pnpm db:migrate` từ máy local hoặc CI trước khi đưa phiên bản mới lên production.

## Cơ sở dữ liệu

- `db/schema.ts`: schema PostgreSQL cho đơn hàng và món trong đơn.
- `db/index.ts`: kết nối PostgreSQL qua `postgres.js` và Drizzle.
- `drizzle/`: migration PostgreSQL do Drizzle Kit tạo.
- Các bảng bật RLS và không cấp quyền Data API; ứng dụng truy cập database qua API server-side của Next.js.

## Xác thực

Supabase Auth lưu session trong cookie qua `@supabase/ssr`. `proxy.ts` làm mới session; mọi thao tác quản lý kiểm tra user ở server và chỉ chấp nhận email `ADMIN_EMAIL`.
