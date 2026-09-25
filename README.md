# MELI — Mì chua cay

Ứng dụng đặt món tại quán và quản lý đơn, chạy bằng Next.js App Router, PostgreSQL/Supabase, Drizzle ORM và Supabase Auth.

## Chạy local

1. Sao chép `.env.example` thành `.env.local`.
2. Trong Supabase Dashboard, mở **Connect → Transaction pooler** để lấy chuỗi kết nối PostgreSQL. Thay `[YOUR-PASSWORD]` bằng mật khẩu database đã tạo trong Supabase. Lưu ý mã hóa URL các ký tự đặc biệt trong mật khẩu. Đặt chuỗi hoàn chỉnh vào `DATABASE_URL`; không commit mật khẩu vào Git.
3. Điền `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` và `ADMIN_EMAIL`.
4. Chạy `pnpm install`, `pnpm db:migrate`, rồi `pnpm dev`.
5. Tạo tài khoản trong Supabase Auth có email trùng `ADMIN_EMAIL` để truy cập `/admin`.

## Deploy Vercel + GitHub

Project Vercel cần đặt **Framework Preset = Next.js** và Root Directory là thư mục gốc repository. Trong Vercel → Project Settings → Environment Variables, đặt bốn biến trong `.env.example` cho Production. `DATABASE_URL` là secret phía server; chỉ dùng URL của **Transaction pooler** cổng 6543 cho Vercel Functions. Hai biến có tiền tố `NEXT_PUBLIC_` được gửi xuống trình duyệt, vì vậy chỉ đặt URL và publishable key vào đó. Sau khi thêm hoặc sửa biến, tạo deployment mới để áp dụng.

Kiểm tra trang khách `/` và trang quản lý `/admin`; tạo một đơn thử và xác nhận nó xuất hiện trong `public.orders` cùng `public.order_items`. Cần có tài khoản Supabase Auth đúng email quản trị trước khi thử nhận và xử lý đơn.

## Cơ sở dữ liệu

- `db/schema.ts`: schema PostgreSQL cho đơn hàng và món trong đơn.
- `db/index.ts`: kết nối PostgreSQL qua `postgres.js` và Drizzle.
- `drizzle/`: migration PostgreSQL do Drizzle Kit tạo.
- Các bảng bật RLS và không cấp quyền Data API; ứng dụng truy cập database qua API server-side của Next.js.

## Xác thực

Supabase Auth lưu session trong cookie qua `@supabase/ssr`. `proxy.ts` làm mới session; mọi thao tác quản lý kiểm tra user ở server và cho phép email `ADMIN_EMAIL` hoặc email đã được quản trị viên cấp trong `public.admin_users`.

Để thêm tên đăng nhập `admin` mà không gửi email xác nhận: trong Supabase Auth → Users, tạo user với email nội bộ `admin@meli.invalid`, đặt mật khẩu mạnh riêng và chọn xác nhận email ngay khi tạo. Sau khi tạo user thành công, thêm email đó vào `public.admin_users` bằng quyền quản trị cơ sở dữ liệu. Giao diện `/login` chấp nhận `admin` và chuyển tên đó thành email nội bộ trước khi gọi Supabase Auth. Không thêm email vào `admin_users` trước khi tài khoản Auth đã được tạo và kiểm tra; không dùng mật khẩu phổ biến như `admin` cho tài khoản quản trị công khai.
