"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError("");
    const { error: authError } = await createClient().auth.signInWithPassword({ email, password });
    if (authError) { setError("Email hoặc mật khẩu không đúng."); setLoading(false); return; }
    const returnTo = new URLSearchParams(window.location.search).get("returnTo");
    window.location.assign(returnTo?.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/admin");
  }
  return <main className="grid min-h-screen place-items-center bg-[#fff8ea] p-6"><form onSubmit={submit} className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-xl">
    <p className="text-sm font-bold uppercase tracking-widest text-[#d6552d]">MELI</p><h1 className="mt-2 text-3xl font-black text-zinc-900">Đăng nhập quản lý</h1>
    <label className="mt-6 block text-sm font-bold">Email<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 w-full rounded-xl border px-4 py-3" /></label>
    <label className="mt-4 block text-sm font-bold">Mật khẩu<input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 w-full rounded-xl border px-4 py-3" /></label>
    {error && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}<button disabled={loading} className="mt-6 w-full rounded-xl bg-[#07572f] px-4 py-3 font-bold text-white disabled:opacity-60">{loading ? "Đang đăng nhập…" : "Đăng nhập"}</button>
  </form></main>;
}
