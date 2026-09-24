"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SetPasswordPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    // Keep the fragment before the auth client initializes: Supabase invite and
    // recovery links can return tokens in the URL fragment.
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const code = new URLSearchParams(window.location.search).get("code");
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active && session?.user.email) {
        setEmail(session.user.email);
        setMessage("");
        setChecking(false);
      }
    });

    async function loadUser() {
      const accessToken = fragment.get("access_token");
      const refreshToken = fragment.get("refresh_token");
      if (accessToken && refreshToken) {
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        window.history.replaceState(null, "", window.location.pathname);
      } else if (code) {
        await supabase.auth.exchangeCodeForSession(code);
        window.history.replaceState(null, "", window.location.pathname);
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      if (user?.email) {
        setEmail(user.email);
        setMessage("");
      } else {
        setMessage("Không xác nhận được phiên đăng nhập. Hãy mở liên kết đặt lại mật khẩu mới từ email.");
      }
      setChecking(false);
    }
    void loadUser();
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 8) { setMessage("Mật khẩu cần ít nhất 8 ký tự."); return; }
    if (password !== confirm) { setMessage("Hai mật khẩu chưa khớp."); return; }
    setLoading(true);
    setMessage("");
    const { error } = await createClient().auth.updateUser({ password });
    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }
    window.location.assign("/admin");
  }

  return <main className="grid min-h-screen place-items-center bg-[#fff8ea] p-6">
    <form onSubmit={submit} className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-xl">
      <p className="text-sm font-bold uppercase tracking-widest text-[#d6552d]">MELI</p>
      <h1 className="mt-2 text-3xl font-black text-zinc-900">Đặt mật khẩu quản lý</h1>
      {email ? <p className="mt-3 text-sm text-zinc-600">{email}</p> : checking ? <p className="mt-3 text-sm text-zinc-600">Đang xác nhận liên kết…</p> : null}
      {email && <>
        <label className="mt-6 block text-sm font-bold">Mật khẩu mới
          <input required minLength={8} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border px-4 py-3" />
        </label>
        <label className="mt-4 block text-sm font-bold">Nhập lại mật khẩu
          <input required minLength={8} type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} className="mt-2 w-full rounded-xl border px-4 py-3" />
        </label>
        <button disabled={loading} className="mt-6 w-full rounded-xl bg-[#07572f] px-4 py-3 font-bold text-white disabled:opacity-60">
          {loading ? "Đang lưu…" : "Lưu mật khẩu"}
        </button>
      </>}
      {message && <p role="alert" className="mt-4 text-sm text-red-700">{message}</p>}
    </form>
  </main>;
}
