"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SetPasswordPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      if (user?.email) setEmail(user.email);
      else setMessage("Liên kết mời không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu lời mời mới.");
    }
    void loadUser();
    return () => { active = false; };
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
      {email ? <p className="mt-3 text-sm text-zinc-600">{email}</p> : <p className="mt-3 text-sm text-zinc-600">Đang xác nhận lời mời…</p>}
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
